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
  - Input file (JSON, written by the QA harness before the run): env COMPAT_INPUT (or COMPAT_INPUT_FILE,
    QA_COMPAT_INPUT), default /run/compat/input.json. Shape "qa-compat-input/1":
      { "format": "qa-compat-input/1", "runId": "...",
        "studentLtik": "...", "deepLinkLtik": "...",
        "expect": { "userId": "5", "platformUrl": "https://moodle.test:8443", "contextId": "2",
                    "memberIds": ["3", "5", "6"], "learnerIds": ["5", "6"] } }
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
from urllib.parse import urlsplit

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

    path = os.environ.get("COMPAT_INPUT") or os.environ.get("COMPAT_INPUT_FILE") or os.environ.get("QA_COMPAT_INPUT") or "/run/compat/input.json"
    data: dict[str, Any] = {}
    if os.path.isfile(path):
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
    for key in ("studentLtik", "deepLinkLtik"):
        if not isinstance(data.get(key), str) or not data[key]:
            fail_input(f"{key} is missing in {source}")
    expect = data.get("expect") or {}
    for key in ("userId", "platformUrl", "contextId", "memberIds"):
        if key not in expect:
            fail_input(f"expect.{key} is missing in {source}")
    return {
        "ltiUrl": lti_url,
        "apiKey": api_key,
        "runId": str(data.get("runId") or "local"),
        "studentLtik": data["studentLtik"],
        "deepLinkLtik": data["deepLinkLtik"],
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
        line_item_id = (token.services.assignment_and_grades or {}).get("lineItemId")
    else:
        # Go on with the other checks: read the same answer without the SDK model (evidence only, not a pass).
        _, raw = run_step(report, "idtoken (unvalidated read, to continue)", lambda: student._request_handler.get(student._service_authorization, "/api/idtoken"))
        if isinstance(raw, dict):
            user_id = str((raw.get("user") or {}).get("id", "")) or None
            line_item_id = ((raw.get("services") or {}).get("assignmentAndGrades") or {}).get("lineItemId")
            print(f"unvalidated id token keys: services={sorted((raw.get('services') or {}).keys())}", flush=True)

    # 2. Deep linking (cg_teacher deep-linking launch): one ltiResourceLink, as a form and as a message.
    title = f"QA compat {run_id}"
    item = LTIResourceLinkContentItem(title=title, url=f"{inputs['ltiUrl']}/lti/launch/cogniate")
    got_form, form = run_step(report, "deep linking form", lambda: teacher.build_deep_linking_form([item], message="QA compat"))
    got_msg, msg = run_step(report, "deep linking message", lambda: teacher.build_deep_linking_form_components([item], message="QA compat"))
    if got_msg:
        try:
            claims = jwt_payload(msg.message)
            items = claims.get("https://purl.imsglobal.org/spec/lti-dl/claim/content_items") or []
            ok = msg.target.startswith("https://") and len(items) == 1 and items[0].get("type") == "ltiResourceLink" and items[0].get("title") == title
            report.check("deep linking message", ok, f"target {msg.target[:80]}; JWT content_items {json.dumps(items)[:300]}")
        except ValueError as err:
            report.check("deep linking message", False, f"message is not a JWT: {err}")
    if got_form:
        html = form.form
        one_form = html.count("<form") == 1
        jwt_input = 'name="JWT"' in html
        target_ok = got_msg and f'action="{msg.target}"' in html.replace("&amp;", "&")
        report.check("deep linking form", one_form and jwt_input and target_ok, f"one <form>: {one_form}; JWT input: {jwt_input}; action = message target: {target_ok}")

    # 3. Score: post with the SDK, read back with the SDK.
    if line_item_id and user_id:
        given, maximum = 7.0, 10.0
        score = Score(user_id=user_id, activity_progress=ActivityProgress.COMPLETED, grading_progress=GradingProgress.FULLY_GRADED, score_given=given, score_maximum=maximum, comment=f"QA compat {run_id}")
        posted, _ = run_step(report, "score post", lambda: student.submit_score(line_item_id, score))
        if posted:
            report.check("score post", True, f"submit_score {given}/{maximum} for user {user_id}")
            got_results, results = run_step(report, "score read", lambda: student.get_scores(line_item_id, user_id=user_id))
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
        want_ids = sorted(str(x) for x in expect["memberIds"])
        personal = [m.user_id for m in members.members if m.email or m.name or m.given_name or m.family_name]
        ok = members.context.id == str(expect["contextId"]) and set(want_ids) <= set(ids)
        report.check("memberships", ok, f"context {members.context.id} (want {expect['contextId']}); members {ids} (must contain {want_ids}); with personal fields: {personal}")

    bad_calls = [c for c in report.calls if not 200 <= c["status"] < 300]
    report.check("http", not bad_calls, f"{len(report.calls)} calls, not 2xx: {bad_calls}")
    for call in report.calls:
        print(f"  {call['method']} {call['path']} → {call['status']}", flush=True)

    ok = all(c["ok"] for c in report.checks)
    print(f"{RESULT_MARK} " + json.dumps({"ok": ok, "sdk": f"ltiaas {version('ltiaas')}", "checks": report.checks, "calls": report.calls}), flush=True)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
