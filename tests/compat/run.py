"""AC-T3-27 independent client (QA, tasks/T3c.md).

Runs the public `ltiaas==0.0.4` Python SDK (MIT, PyPI; a client we did not write) against our LTI service with real
ltiks that the QA harness captured from Moodle launches. QA writes this script from tasks/T3c.md and the LTI contract
(lti-service-api.md §3.1, §3.2, §3.6, §3.7, §8). It does not copy SDK or LTIAAS code: it only calls the SDK.

Checks (AC-T3-27):
  1. id token: read with the SDK; user id, platform URL and context id match the launch.
  2. deep linking: build a form and a message for one ltiResourceLink with the cg_teacher deep-linking ltik.
  3. score: post a score with the SDK and read it back; the value matches.
  4. memberships: list them with the SDK; the course members are there.
Every HTTP call must be 2xx, and every field that the SDK reads must exist (the SDK validates the answers with its own
models; a missing field gives a ValidationError that names the field).

Inputs (no secrets on the command line, none in the output):
  - PUBLIC_LTI_URL (env): base URL of the LTI service.
  - API key file: env LTI_API_KEY_FILE (default /run/secrets/lti-api-key.cogniate).
  - Input file (JSON, written by the QA harness before the run): the first existing path of env COMPAT_INPUT,
    COMPAT_INPUT_FILE, QA_COMPAT_INPUT and /run/compat/input.json. Shape "qa-compat-input/1":
      { "format": "qa-compat-input/1", "runId": "...",
        "studentLtik": "...", "deepLinkLtik": "...",            (alias: teacherDeepLinkingLtik)
        "expect": { "userId": "5", "platformUrl": "https://moodle.test:8443", "contextId": "2",   (alias: expected)
                    "memberIds": ["3", "5", "6"] },              (optional; default [userId])
        "lineItemId": "..." }                                    (optional; default: from the ID token)
    Without the file, the same values come from QA_* env: QA_COMPAT_STUDENT_LTIK, QA_COMPAT_DEEPLINK_LTIK,
    QA_COMPAT_RUN_ID, QA_COMPAT_EXPECT (JSON of "expect").

Output: one line per check ("PASS|FAIL <check>: <detail>"), the HTTP calls (method, path, status), and at the end one
line "QA_COMPAT_RESULT <json>" for the harness. Exit 0 = every check passed; 1 = a check failed; 2 = bad input.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import traceback
from importlib.metadata import version
from typing import Any, Callable
from urllib.parse import quote, urlsplit

RESULT_MARK = "QA_COMPAT_RESULT"


def fail_input(message: str) -> None:
    print(f"INPUT ERROR: {message}", flush=True)
    print(f"{RESULT_MARK} " + json.dumps({"ok": False, "inputError": message}), flush=True)
    sys.exit(2)


def read_inputs() -> dict[str, Any]:
    lti_url = os.environ.get("PUBLIC_LTI_URL", "").rstrip("/")
    if not lti_url.startswith("https://"):
        fail_input("PUBLIC_LTI_URL is not set to an https URL")
    key_file = os.environ.get("LTI_API_KEY_FILE", "/run/secrets/lti-api-key.cogniate")
    try:
        with open(key_file, encoding="utf-8") as fh:
            api_key = fh.read().strip()
    except OSError as err:
        fail_input(f"cannot read the API key file {key_file}: {err.strerror}")
    if not api_key:
        fail_input(f"the API key file {key_file} is empty")

    # The first of these paths that exists in the container (COMPAT_INPUT_FILE can also hold the host path).
    candidates = [os.environ.get(k, "") for k in ("COMPAT_INPUT", "COMPAT_INPUT_FILE", "QA_COMPAT_INPUT")] + ["/run/compat/input.json"]
    path = next((c for c in candidates if c and os.path.isfile(c)), "")
    data: dict[str, Any] = {}
    if path:
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError) as err:
            fail_input(f"cannot read the input file {path}: {err}")
        source = path
    else:
        try:
            expect = json.loads(os.environ.get("QA_COMPAT_EXPECT", "{}"))
        except ValueError:
            fail_input("QA_COMPAT_EXPECT is not JSON")
        data = {
            "runId": os.environ.get("QA_COMPAT_RUN_ID", "local"),
            "studentLtik": os.environ.get("QA_COMPAT_STUDENT_LTIK", ""),
            "deepLinkLtik": os.environ.get("QA_COMPAT_DEEPLINK_LTIK", ""),
            "expect": expect,
        }
        source = "QA_* environment"
    # Aliases of the infra/README.md example: teacherDeepLinkingLtik, expected.
    if not data.get("deepLinkLtik") and data.get("teacherDeepLinkingLtik"):
        data["deepLinkLtik"] = data["teacherDeepLinkingLtik"]
    for key in ("studentLtik", "deepLinkLtik"):
        if not isinstance(data.get(key), str) or not data[key]:
            fail_input(f"{key} is missing in {source}")
    expect = data.get("expect") or data.get("expected") or {}
    for key in ("userId", "platformUrl", "contextId"):
        if key not in expect:
            fail_input(f"expect.{key} is missing in {source}")
    return {
        "ltiUrl": lti_url,
        "apiKey": api_key,
        "runId": str(data.get("runId") or "local"),
        "studentLtik": data["studentLtik"],
        "deepLinkLtik": data["deepLinkLtik"],
        "lineItemId": data.get("lineItemId") or None,
        "expect": expect,
        "source": source,
    }


def shape(value: str) -> str:
    """Evidence for a secret: first 6 characters and the length only."""
    return f"{value[:6]}… ({len(value)} chars)"


def jwt_payload(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError(f"not a JWT ({len(parts)} parts)")
    body = parts[1] + "=" * (-len(parts[1]) % 4)
    return json.loads(base64.urlsafe_b64decode(body.encode("ascii")))


class Report:
    def __init__(self) -> None:
        self.checks: list[dict[str, Any]] = []
        self.calls: list[dict[str, Any]] = []

    def record_call(self, response: Any, *_args: Any, **_kwargs: Any) -> None:
        # requests response hook: method, path (no query, no headers) and status only.
        req = response.request
        self.calls.append({"method": req.method, "path": urlsplit(req.url).path, "status": response.status_code})

    def check(self, name: str, ok: bool, detail: str, **extra: Any) -> bool:
        self.checks.append({"check": name, "ok": bool(ok), "detail": detail, **extra})
        print(f"{'PASS' if ok else 'FAIL'} {name}: {detail}", flush=True)
        return ok


def describe_error(err: BaseException) -> dict[str, Any]:
    """SDK errors: APIError (HTTP status and the error body) or ValidationError (the fields the SDK misses)."""
    from ltiaas.exceptions.api_error import APIError
    from ltiaas.exceptions.validation_error import ValidationError

    if isinstance(err, APIError):
        resp = err.response
        if resp is None:
            return {"kind": "APIError", "message": str(err)[:500]}
        details = getattr(resp, "details", None)
        return {
            "kind": "APIError",
            "status": resp.status,
            "error": resp.error,
            "code": getattr(details, "message", None) if details else None,
            "body": str(getattr(details, "bodyReceived", "") or "")[:300] if details else "",
        }
    if isinstance(err, ValidationError):
        return {"kind": "ValidationError", "message": str(err)[:1500]}
    return {"kind": type(err).__name__, "message": str(err)[:500], "trace": traceback.format_exc(limit=3)[-800:]}


def run_step(report: Report, name: str, fn: Callable[[], Any]) -> tuple[bool, Any]:
    """(True, value) when the SDK call returns; (False, None) after it raised (the failure is recorded)."""
    try:
        return True, fn()
    except Exception as err:  # noqa: BLE001 - every SDK failure is evidence
        info = describe_error(err)
        report.check(name, False, f"SDK call failed: {json.dumps(info)[:1500]}", error=info)
        return False, None


def main() -> int:
    inputs = read_inputs()
    from ltiaas import (  # the SDK under test
        ActivityProgress,
        GradingProgress,
        LTIAASLaunch,
        LTIResourceLinkContentItem,
        Score,
    )

    report = Report()
    domain = urlsplit(inputs["ltiUrl"]).netloc  # the SDK takes a host (and port), and adds https://
    expect = inputs["expect"]
    run_id = inputs["runId"]
    print(f"ltiaas {version('ltiaas')}; service {inputs['ltiUrl']}; input from {inputs['source']}", flush=True)
    print(f"student ltik {shape(inputs['studentLtik'])}; deep-linking ltik {shape(inputs['deepLinkLtik'])}; API key {shape(inputs['apiKey'])}", flush=True)

    student = LTIAASLaunch(domain=domain, api_key=inputs["apiKey"], ltik=inputs["studentLtik"])
    teacher = LTIAASLaunch(domain=domain, api_key=inputs["apiKey"], ltik=inputs["deepLinkLtik"])
    for client in (student, teacher):
        client._request_handler.session.hooks["response"].append(report.record_call)  # instrumentation only

    # 1. ID token (cg_student launch).
    line_item_id = None
    user_id = None
    got_token, token = run_step(report, "idtoken", student.get_id_token)
    if got_token:
        context_id = str((token.launch.context or {}).get("id", ""))
        got = {"userId": token.user.id, "platformUrl": token.platform.url, "contextId": context_id}
        want = {"userId": str(expect["userId"]), "platformUrl": str(expect["platformUrl"]), "contextId": str(expect["contextId"])}
        report.check("idtoken", got == want, f"user id, platform URL, context id: got {got}, want {want}; launch type {token.launch.type.value}")
        user_id = token.user.id
        line_item_id = (token.services.assignment_and_grades or {}).get("lineItemId") or inputs["lineItemId"]
    else:
        # Go on with the other checks: read the same answer without the SDK model (evidence only, not a pass).
        _, raw = run_step(report, "idtoken (unvalidated read, to continue)", lambda: student._request_handler.get(student._service_authorization, "/api/idtoken"))
        if isinstance(raw, dict):
            user_id = str((raw.get("user") or {}).get("id", "")) or None
            line_item_id = ((raw.get("services") or {}).get("assignmentAndGrades") or {}).get("lineItemId") or inputs["lineItemId"]
            print(f"unvalidated id token keys: services={sorted((raw.get('services') or {}).keys())}", flush=True)

    # 2. Deep linking (cg_teacher deep-linking launch): one ltiResourceLink, as a form and as a message.
    # No `url`: ltiaas 0.0.4 cannot serialize an HttpUrl field (its to_json uses o.__dict__, which a pydantic Url does
    # not have), so a tool that uses this SDK sends `"url": null`. Contract §3.2: without a url the service sets
    # {PUBLIC_LTI_URL}/lti/launch/{toolAccountId}.
    title = f"QA compat {run_id}"
    item = LTIResourceLinkContentItem(title=title)
    got_form, form = run_step(report, "deep linking form", lambda: teacher.build_deep_linking_form([item], message="QA compat"))
    got_msg, msg = run_step(report, "deep linking message", lambda: teacher.build_deep_linking_form_components([item], message="QA compat"))
    if got_msg:
        try:
            claims = jwt_payload(msg.message)
            items = claims.get("https://purl.imsglobal.org/spec/lti-dl/claim/content_items") or []
            default_url = f"{inputs['ltiUrl']}/lti/launch/cogniate"
            ok = (
                msg.target.startswith("https://")
                and len(items) == 1
                and items[0].get("type") == "ltiResourceLink"
                and items[0].get("title") == title
                and str(items[0].get("url", "")).startswith(default_url)
            )
            report.check("deep linking message", ok, f"target {msg.target[:80]}; JWT content_items {json.dumps(items)[:300]} (url must start with {default_url})")
        except ValueError as err:
            report.check("deep linking message", False, f"message is not a JWT: {err}")
    if got_form:
        html = form.form
        one_form = html.count("<form") == 1
        jwt_input = 'name="JWT"' in html
        target_ok = got_msg and f'action="{msg.target}"' in html.replace("&amp;", "&")
        report.check("deep linking form", one_form and jwt_input and target_ok, f"one <form>: {one_form}; JWT input: {jwt_input}; action = message target: {target_ok}")

    # 3. Score: post with the SDK, read back with the SDK. The SDK does not encode line item ids (contract §8 D15): QA
    # passes the id already encoded, as encodeURIComponent does (the public reference); the SDK's quote() then encodes
    # it once more, which the service accepts (T3c round 3).
    encoded_id = quote(line_item_id, safe="") if line_item_id else None
    if line_item_id and user_id:
        given, maximum = 7.0, 10.0
        score = Score(user_id=user_id, activity_progress=ActivityProgress.COMPLETED, grading_progress=GradingProgress.FULLY_GRADED, score_given=given, score_maximum=maximum, comment=f"QA compat {run_id}")
        posted, _ = run_step(report, "score post", lambda: student.submit_score(encoded_id, score))
        if posted:
            report.check("score post", True, f"submit_score {given}/{maximum} for user {user_id}")
            got_results, results = run_step(report, "score read", lambda: student.get_scores(encoded_id, user_id=user_id))
            if got_results:
                mine = [r for r in results.scores if r.user_id == user_id]
                others = [r.user_id for r in results.scores if r.user_id != user_id]
                ratio = (mine[0].result_score / mine[0].result_maximum) if mine and mine[0].result_score is not None and mine[0].result_maximum else None
                ok = ratio is not None and abs(ratio - given / maximum) < 0.001
                report.check(
                    "score read",
                    ok,
                    f"result for user {user_id}: {mine[0].result_score if mine else None}/{mine[0].result_maximum if mine else None} (ratio {ratio}, want {given / maximum}); other users in the answer: {others}",
                    otherUsers=others,
                )
    else:
        report.check("score post", False, f"no line item id ({bool(line_item_id)}) or user id ({bool(user_id)}) from the id token")

    # 4. Memberships (cg_student launch).
    got_members, members = run_step(report, "memberships", student.get_memberships)
    if got_members:
        ids = sorted(m.user_id for m in members.members)
        want_ids = sorted(str(x) for x in expect.get("memberIds", [expect["userId"]]))
        personal = [m.user_id for m in members.members if m.email or m.name or m.given_name or m.family_name]
        ok = members.context.id == str(expect["contextId"]) and set(want_ids) <= set(ids)
        report.check("memberships", ok, f"context {members.context.id} (want {expect['contextId']}); members {ids} (must contain {want_ids}); with personal fields: {personal}")

    bad_calls = [c for c in report.calls if not 200 <= c["status"] < 300]
    report.check("http", bool(report.calls) and not bad_calls, f"{len(report.calls)} calls, not 2xx: {bad_calls}")
    for call in report.calls:
        print(f"  {call['method']} {call['path']} → {call['status']}", flush=True)

    # D15 (contract §8): the SDK's own unencoded line item id is expected to give 404 NOT_FOUND. Evidence, outside the
    # "every call 2xx" check above.
    d15: dict[str, Any] = {}
    if line_item_id and user_id:
        before = len(report.calls)
        try:
            student.get_scores(line_item_id, user_id=user_id)
            d15 = {"status": report.calls[-1]["status"] if len(report.calls) > before else None, "raised": False}
        except Exception as err:  # noqa: BLE001
            d15 = {"raised": True, **describe_error(err)}
        print(f"D15 raw line item id (expected 404): {json.dumps(d15)[:400]}", flush=True)

    ok = all(c["ok"] for c in report.checks)
    print(f"{RESULT_MARK} " + json.dumps({"ok": ok, "sdk": f"ltiaas {version('ltiaas')}", "checks": report.checks, "calls": report.calls, "d15RawId": d15}), flush=True)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
