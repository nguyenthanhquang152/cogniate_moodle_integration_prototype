<?php
// Add an External tool (mod_lti) activity that uses a preconfigured tool type. Idempotent by name in the course:
// a rerun updates the type, tool URL, grade (100) and "accept grades" of the existing activity.
// --completion=grade (T7): completion "Receive a grade" (automatic, use grade). Output: one JSON line {cmid, instanceid, courseid, typeid}.
// Run: infra/scripts/moodle-php.sh /opt/cogniate/php/add_lti_activity.php --course=COGNIATE-DEV-101 --typeid=1 [--toolurl=URL]
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');
require_once($CFG->libdir . '/completionlib.php');

[$options] = cli_get_params([
    'course' => 'COGNIATE-DEV-101', 'typeid' => '', 'name' => 'Cogniate LTI activity', 'section' => '1', 'toolurl' => '', 'completion' => '', 'help' => false,
]);
if ($options['help'] || $options['typeid'] === '') {
    echo "Options: --course=SHORTNAME --typeid=N [--name=...] [--section=1] [--toolurl=URL (default: the type URL)] [--completion=grade]\n";
    exit($options['help'] ? 0 : 1);
}
\core\session\manager::set_user(get_admin());
$course = $DB->get_record('course', ['shortname' => $options['course']], '*', MUST_EXIST);
$receivegrade = $options['completion'] === 'grade';

$existing = $DB->get_record('lti', ['course' => $course->id, 'name' => $options['name']]);
if ($existing) {
    $cm = get_coursemodule_from_instance('lti', $existing->id, $course->id, false, MUST_EXIST);
    if ((int) $existing->typeid !== (int) $options['typeid'] || (string) $existing->toolurl !== $options['toolurl']
            || (int) $existing->grade !== 100 || (int) $existing->instructorchoiceacceptgrades !== 1) {
        $DB->update_record('lti', (object) ['id' => $existing->id, 'typeid' => (int) $options['typeid'], 'toolurl' => $options['toolurl'],
            'grade' => 100, 'instructorchoiceacceptgrades' => 1, 'timemodified' => time()]);
        rebuild_course_cache($course->id, true);
    }
    if ($receivegrade && ((int) $cm->completion !== COMPLETION_TRACKING_AUTOMATIC || $cm->completiongradeitemnumber === null)) {
        $DB->update_record('course_modules', (object) ['id' => $cm->id, 'completion' => COMPLETION_TRACKING_AUTOMATIC, 'completiongradeitemnumber' => 0]);
        rebuild_course_cache($course->id, true);
    }
    $out = ['cmid' => (int) $cm->id, 'instanceid' => (int) $existing->id];
} else {
    $mi = (object) [
        'modulename' => 'lti',
        'module' => $DB->get_field('modules', 'id', ['name' => 'lti'], MUST_EXIST),
        'course' => $course->id,
        'section' => (int) $options['section'],
        'visible' => 1,
        'name' => $options['name'],
        'intro' => '', 'introformat' => FORMAT_HTML, 'showdescription' => 0,
        'typeid' => (int) $options['typeid'],
        'toolurl' => $options['toolurl'], 'securetoolurl' => '', 'icon' => '', 'secureicon' => '',
        'launchcontainer' => LTI_LAUNCH_CONTAINER_DEFAULT,
        'instructorchoicesendname' => 0, 'instructorchoicesendemailaddr' => 0,
        'instructorchoiceacceptgrades' => 1, 'instructorcustomparameters' => '',
        'grade' => 100, 'cmidnumber' => '',
    ];
    if ($receivegrade) {
        $mi->completion = COMPLETION_TRACKING_AUTOMATIC; // "Receive a grade" (completion must be on in the course: seed)
        $mi->completionusegrade = 1;
    }
    $mi = add_moduleinfo($mi, $course);
    $out = ['cmid' => (int) $mi->coursemodule, 'instanceid' => (int) $mi->instance];
}
echo json_encode($out + ['courseid' => (int) $course->id, 'typeid' => (int) $options['typeid'],
    'launchurl' => $CFG->wwwroot . '/mod/lti/launch.php?id=' . $out['cmid']], JSON_UNESCAPED_SLASHES) . "\n";
