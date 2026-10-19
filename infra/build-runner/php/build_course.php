<?php
// T8 Build Runner: runs INSIDE the throwaway build Moodle (internal network, no internet, no link to the main stack).
// Input: /opt/cogniate/in/job.json {title, idnumber} (written by infra/scripts/build-runner.sh from checked fields) and
// /opt/cogniate/in/package.zip (read-only). Steps (one per run, so the host runner can report and fail per step):
//   --step=course  a hidden course, idnumber cogniate:{courseId}:{variant}:{lang}, completion tracking on
//   --step=scorm   one SCORM activity from the package: grade method "highest", maximum grade 100,
//                  completion "Receive a grade" (automatic, use grade)
//   --step=backup  a course backup WITHOUT users to /var/www/moodledata/cogniate-out/course.mbz (inside the container;
//                  the host runner takes it out with docker cp)
// Output: one JSON line per step.
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->dirroot . '/mod/scorm/lib.php');
require_once($CFG->dirroot . '/mod/scorm/locallib.php');

[$options] = cli_get_params(['step' => '', 'help' => false]);
$job = json_decode((string) file_get_contents('/opt/cogniate/in/job.json'), true);
if ($options['help'] || !in_array($options['step'], ['course', 'scorm', 'backup'], true) || !is_array($job)) {
    echo "Options: --step=course|scorm|backup (job in /opt/cogniate/in/job.json)\n";
    exit($options['help'] ? 0 : 1);
}
$admin = get_admin();
\core\session\manager::set_user($admin);
$out = ['step' => $options['step']];

if ($options['step'] === 'course') {
    $course = $DB->get_record('course', ['idnumber' => $job['idnumber']]);
    if (!$course) {
        $category = (int) $DB->get_field_sql('SELECT MIN(id) FROM {course_categories}');
        $course = create_course((object) [
            'category' => $category, 'fullname' => $job['title'], 'shortname' => $job['idnumber'], 'idnumber' => $job['idnumber'],
            'visible' => 0, 'enablecompletion' => 1, 'format' => 'topics', 'numsections' => 1, 'summary' => '', 'summaryformat' => FORMAT_HTML,
        ]);
    }
    // A backup without users (the runner Moodle has only the admin anyway).
    set_config('backup_general_users', 0, 'backup');
    $out += ['courseid' => (int) $course->id, 'idnumber' => $course->idnumber, 'visible' => (int) $course->visible];
} else {
    $course = $DB->get_record('course', ['idnumber' => $job['idnumber']], '*', MUST_EXIST);
}

if ($options['step'] === 'scorm') {
    $scorm = $DB->get_record('scorm', ['course' => $course->id]);
    if (!$scorm) {
        $draftid = file_get_unused_draft_itemid();
        get_file_storage()->create_file_from_pathname([
            'component' => 'user', 'filearea' => 'draft', 'contextid' => context_user::instance($admin->id)->id,
            'itemid' => $draftid, 'filepath' => '/', 'filename' => 'package.zip',
        ], '/opt/cogniate/in/package.zip');
        $c = get_config('scorm');
        $mi = add_moduleinfo((object) [
            'modulename' => 'scorm', 'module' => $DB->get_field('modules', 'id', ['name' => 'scorm'], MUST_EXIST),
            'course' => $course->id, 'section' => 1, 'visible' => 1, 'name' => $job['title'], 'intro' => '', 'introformat' => FORMAT_HTML,
            'cmidnumber' => '', 'scormtype' => SCORM_TYPE_LOCAL, 'packagefile' => $draftid, 'packageurl' => '', 'updatefreq' => SCORM_UPDATE_NEVER,
            'popup' => 0, 'width' => $c->framewidth, 'height' => $c->frameheight, 'skipview' => $c->skipview, 'hidebrowse' => $c->hidebrowse,
            'displaycoursestructure' => $c->displaycoursestructure, 'hidetoc' => $c->hidetoc, 'nav' => $c->nav,
            'navpositionleft' => $c->navpositionleft, 'navpositiontop' => $c->navpositiontop, 'displayattemptstatus' => $c->displayattemptstatus,
            'timeopen' => 0, 'timeclose' => 0,
            // Grade method "highest" (of the SCOs and of the attempts), maximum 100.
            'grademethod' => GRADEHIGHEST, 'maxgrade' => 100, 'maxattempt' => $c->maxattempt, 'whatgrade' => HIGHESTATTEMPT,
            'forcenewattempt' => $c->forcenewattempt, 'lastattemptlock' => $c->lastattemptlock, 'forcecompleted' => $c->forcecompleted,
            'masteryoverride' => $c->masteryoverride, 'auto' => $c->auto,
            // Completion "Receive a grade".
            'completion' => COMPLETION_TRACKING_AUTOMATIC, 'completionusegrade' => 1,
        ], $course);
        $scorm = $DB->get_record('scorm', ['id' => $mi->instance], '*', MUST_EXIST);
    }
    $cm = get_coursemodule_from_instance('scorm', $scorm->id, $course->id, false, MUST_EXIST);
    $out += ['cmid' => (int) $cm->id, 'version' => $scorm->version, 'grademethod' => (int) $scorm->grademethod, 'completion' => (int) $cm->completion];
}

if ($options['step'] === 'backup') {
    require_once($CFG->dirroot . '/backup/util/includes/backup_includes.php');
    $bc = new backup_controller(backup::TYPE_1COURSE, $course->id, backup::FORMAT_MOODLE, backup::INTERACTIVE_NO, backup::MODE_GENERAL, $admin->id);
    $users = $bc->get_plan()->get_setting('users');
    if ($users->get_value()) {
        $users->set_value(false);
    }
    $bc->execute_plan();
    $file = $bc->get_results()['backup_destination'];
    $dir = $CFG->dataroot . '/cogniate-out';
    check_dir_exists($dir, true, true);
    $file->copy_content_to($dir . '/course.mbz');
    $bc->destroy();
    $out += ['bytes' => filesize($dir . '/course.mbz')];
}
echo json_encode($out, JSON_UNESCAPED_SLASHES) . "\n";
