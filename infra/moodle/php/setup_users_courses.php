<?php
// Test users and courses for the stack. Idempotent: users and courses are found by username / shortname.
//  - users cg_teacher, cg_student, cg_student2 (manual auth). Passwords: JSON object on stdin
//    {"admin":"..","cg_teacher":"..","cg_student":"..","cg_student2":".."}; every run sets them again from .env.
//    The admin user is made by the Moodle image at install; seed resets its password too (B-T1-02).
//  - courses COGNIATE-DEV-101 and COGNIATE-DEV-102 with completion tracking on (site setting too).
//  - the same enrolments in both: cg_teacher = editingteacher, students = student (manual enrolment).
// Output: progress on stderr; one JSON line on stdout:
//   {"users":{"admin":{"id":2},"cg_teacher":{"id":..},...},"courses":{"COGNIATE-DEV-101":{"id":..,"enablecompletion":1,"roles":{..}},..}}
// Run: npm run seed (it pipes the passwords from .env).
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->libdir . '/enrollib.php');

$users = [
    'cg_teacher' => ['Tina', 'Teacher', 'editingteacher'],
    'cg_student' => ['Sam', 'Student', 'student'],
    'cg_student2' => ['Alex', 'Student', 'student'],
];
$courses = [
    'COGNIATE-DEV-101' => 'Cogniate Dev Course 101',
    'COGNIATE-DEV-102' => 'Cogniate Dev Course 102',
];

$passwords = json_decode((string) stream_get_contents(STDIN), true);
foreach (array_merge(['admin'], array_keys($users)) as $username) {
    if (!is_array($passwords) || empty($passwords[$username]) || !is_string($passwords[$username])) {
        cli_error("Missing password for $username on stdin (JSON object).");
    }
}

\core\session\manager::set_user(get_admin());
set_config('enablecompletion', 1);
update_internal_user_password(get_admin(), $passwords['admin']);

$records = [];
foreach ($users as $username => [$first, $last]) {
    $u = $DB->get_record('user', ['username' => $username, 'deleted' => 0]);
    if ($u) {
        update_internal_user_password($u, $passwords[$username]);
    } else {
        $id = user_create_user((object) [
            'username' => $username, 'auth' => 'manual', 'password' => $passwords[$username],
            'firstname' => $first, 'lastname' => $last, 'email' => $username . '@example.invalid',
            'confirmed' => 1, 'mnethostid' => $CFG->mnet_localhost_id,
        ], true, false);
        $u = $DB->get_record('user', ['id' => $id], '*', MUST_EXIST);
    }
    $records[$username] = $u;
}

$manual = enrol_get_plugin('manual');
$result = ['users' => ['admin' => ['id' => (int) get_admin()->id]], 'courses' => []];
foreach ($records as $username => $u) {
    $result['users'][$username] = ['id' => (int) $u->id];
}
foreach ($courses as $shortname => $fullname) {
    $course = $DB->get_record('course', ['shortname' => $shortname]);
    if (!$course) {
        $course = create_course((object) [
            'category' => core_course_category::get_default()->id,
            'shortname' => $shortname, 'fullname' => $fullname,
            'format' => 'topics', 'numsections' => 3, 'visible' => 1, 'enablecompletion' => 1,
        ]);
    } else if ((int) $course->enablecompletion !== 1) {
        update_course((object) ['id' => $course->id, 'enablecompletion' => 1]);
    }

    $instance = $DB->get_record('enrol', ['courseid' => $course->id, 'enrol' => 'manual'], '*', IGNORE_MULTIPLE);
    if (!$instance) {
        $instance = $DB->get_record('enrol', ['id' => $manual->add_default_instance($course)], '*', MUST_EXIST);
    }
    $ctx = context_course::instance($course->id);
    $out = ['courseid' => (int) $course->id, 'shortname' => $shortname,
        'enablecompletion' => (int) $DB->get_field('course', 'enablecompletion', ['id' => $course->id])];
    foreach ($users as $username => [, , $rolename]) {
        $roleid = (int) $DB->get_field('role', 'id', ['shortname' => $rolename], MUST_EXIST);
        $manual->enrol_user($instance, $records[$username]->id, $roleid); // Existing enrolment: no duplicate.
        $out['roles'][$username] = array_values(array_map(fn($r) => $r->shortname, get_user_roles($ctx, $records[$username]->id)));
    }
    fwrite(STDERR, '   ' . json_encode($out) . "\n");
    $result['courses'][$shortname] = ['id' => $out['courseid'], 'enablecompletion' => $out['enablecompletion'], 'roles' => $out['roles']];
}
echo json_encode($result) . "\n";
