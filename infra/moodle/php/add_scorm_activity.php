<?php
// Add a native SCORM activity from a package zip. Moodle validates and parses the package (scorm_parse).
// Idempotent by activity name in the course. Output: one JSON line with cmid, scoes and timing.
// Run: infra/scripts/moodle-php.sh /opt/cogniate/php/add_scorm_activity.php --course=COGNIATE-DEV-101 \
//        --file=/opt/cogniate/fixtures/cogniate-scorm-v2.zip [--name="..."]
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->dirroot . '/mod/scorm/lib.php');
require_once($CFG->dirroot . '/mod/scorm/locallib.php');

[$options] = cli_get_params([
    'course' => 'COGNIATE-DEV-101', 'file' => '', 'name' => 'Cogniate SCORM (native)', 'section' => '1', 'help' => false,
]);
if ($options['help'] || $options['file'] === '' || !is_readable($options['file'])) {
    echo "Options: --course=SHORTNAME --file=/opt/cogniate/fixtures/x.zip [--name=...] [--section=1]\n";
    exit($options['help'] ? 0 : 1);
}
\core\session\manager::set_user(get_admin());
$course = $DB->get_record('course', ['shortname' => $options['course']], '*', MUST_EXIST);
$start = microtime(true);

$scorm = $DB->get_record('scorm', ['course' => $course->id, 'name' => $options['name']]);
if (!$scorm) {
    // 1. Put the zip in the admin user's draft area (same as a form upload).
    $draftid = file_get_unused_draft_itemid();
    get_file_storage()->create_file_from_pathname([
        'component' => 'user', 'filearea' => 'draft', 'contextid' => context_user::instance($USER->id)->id,
        'itemid' => $draftid, 'filepath' => '/', 'filename' => basename($options['file']),
    ], $options['file']);

    // 2. Module info with the site SCORM defaults (as the core SCORM test generator does).
    $c = get_config('scorm');
    $mi = (object) [
        'modulename' => 'scorm', 'module' => $DB->get_field('modules', 'id', ['name' => 'scorm'], MUST_EXIST),
        'course' => $course->id, 'section' => (int) $options['section'], 'visible' => 1,
        'name' => $options['name'], 'intro' => '', 'introformat' => FORMAT_HTML, 'cmidnumber' => '',
        'scormtype' => SCORM_TYPE_LOCAL, 'packagefile' => $draftid, 'packageurl' => '', 'updatefreq' => SCORM_UPDATE_NEVER,
        'popup' => 0, 'width' => $c->framewidth, 'height' => $c->frameheight, 'skipview' => $c->skipview,
        'hidebrowse' => $c->hidebrowse, 'displaycoursestructure' => $c->displaycoursestructure, 'hidetoc' => $c->hidetoc,
        'nav' => $c->nav, 'navpositionleft' => $c->navpositionleft, 'navpositiontop' => $c->navpositiontop,
        'displayattemptstatus' => $c->displayattemptstatus, 'timeopen' => 0, 'timeclose' => 0,
        'grademethod' => GRADESCOES, 'maxgrade' => $c->maxgrade, 'maxattempt' => $c->maxattempt,
        'whatgrade' => $c->whatgrade, 'forcenewattempt' => $c->forcenewattempt, 'lastattemptlock' => $c->lastattemptlock,
        'forcecompleted' => $c->forcecompleted, 'masteryoverride' => $c->masteryoverride, 'auto' => $c->auto,
    ];
    $mi = add_moduleinfo($mi, $course);
    $scorm = $DB->get_record('scorm', ['id' => $mi->instance], '*', MUST_EXIST);
}
$cm = get_coursemodule_from_instance('scorm', $scorm->id, $course->id, false, MUST_EXIST);
$scoes = $DB->get_records('scorm_scoes', ['scorm' => $scorm->id], 'sortorder', 'id,identifier,title,scormtype,launch');
$masteryscore = $DB->get_records_sql(
    "SELECT d.name, d.value FROM {scorm_scoes_data} d JOIN {scorm_scoes} s ON s.id = d.scoid WHERE s.scorm = ?", [$scorm->id]);
$files = get_file_storage()->get_area_files(context_module::instance($cm->id)->id, 'mod_scorm', 'content', 0, 'id', false);

echo json_encode([
    'cmid' => (int) $cm->id, 'scormid' => (int) $scorm->id, 'version' => $scorm->version, 'reference' => $scorm->reference,
    'launch_sco' => (int) $scorm->launch, 'scoes' => array_values($scoes),
    'scoes_data' => array_map(fn($r) => $r->value, $masteryscore),
    'content_files' => count($files), 'seconds' => round(microtime(true) - $start, 2),
    'view_url' => $CFG->wwwroot . '/mod/scorm/view.php?id=' . $cm->id,
], JSON_UNESCAPED_SLASHES) . "\n";
