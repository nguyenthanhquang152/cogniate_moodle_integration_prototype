<?php
// Enable REST web services and make one external service + user + role + permanent token per profile.
// Idempotent: a rerun reuses the user, role, service and token (no duplicates).
//   --profile=product    Cogniate connector (9 functions, narrow role). Used by the product.
//   --profile=qa_oracle  DEV/TEST ONLY. QA reads Moodle state with it (grades, completion, enrolments).
//                        Role = manager archetype + webservice/rest:use. Never configure it on a real site.
// Output (stdout): one JSON line {profile, service, username, userid, serviceid, token, functions}.
// Run: npm run seed (it calls both profiles). Manual: infra/scripts/moodle-php.sh /opt/cogniate/php/setup_webservices.php --profile=product

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/user/lib.php');

$profiles = [
    'product' => [
        'username' => 'cogniate_integration',
        'firstname' => 'Cogniate',
        'lastname' => 'Integration',
        'role' => ['shortname' => 'cogniateintegration', 'name' => 'Cogniate integration', 'archetype' => ''],
        'caps' => [
            'webservice/rest:use',
            'moodle/webservice:createtoken',
            'moodle/course:create', 'moodle/course:update', 'moodle/course:view', 'moodle/course:visibility',
            'moodle/course:viewhiddencourses', 'moodle/course:viewhiddensections', 'moodle/course:viewhiddenactivities',
            'moodle/category:viewcourselist', 'moodle/category:viewhiddencategories', 'moodle/category:manage',
            'moodle/user:create', 'moodle/user:viewdetails', 'moodle/user:viewalldetails', 'moodle/user:viewhiddendetails',
            'moodle/site:viewuseridentity', 'moodle/course:useremail',
            'enrol/manual:enrol', 'moodle/role:assign', 'moodle/course:enrolreview',
        ],
        'assignroles' => ['student', 'editingteacher', 'teacher'], // enrol_manual_enrol_users needs these.
        'service' => ['shortname' => 'cogniate_integration', 'name' => 'Cogniate integration'],
        'functions' => [
            'core_webservice_get_site_info',
            'core_course_create_courses',
            'core_course_get_courses_by_field',
            'core_course_get_contents',
            'core_course_get_categories',
            'core_course_create_categories',
            'enrol_manual_enrol_users',
            'core_user_create_users',
            'core_user_get_users_by_field',
        ],
        'tokenname' => 'cogniate-dev',
    ],
    'qa_oracle' => [
        'username' => 'cogniate_qa_oracle',
        'firstname' => 'QA',
        'lastname' => 'Oracle (dev/test only)',
        'role' => ['shortname' => 'cogniateqaoracle', 'name' => 'Cogniate QA oracle (dev/test only)', 'archetype' => 'manager'],
        'caps' => ['webservice/rest:use'],
        'assignroles' => [],
        'service' => ['shortname' => 'cogniate_qa_oracle', 'name' => 'Cogniate QA oracle (dev/test only)'],
        'functions' => [
            'gradereport_user_get_grade_items',
            'core_completion_get_activities_completion_status',
            'core_enrol_get_enrolled_users',
            'core_course_get_contents',
            'core_course_get_courses_by_field',
            'core_course_update_courses',
        ],
        'tokenname' => 'cogniate-qa-oracle',
    ],
];

[$options] = cli_get_params(['profile' => '', 'help' => false]);
if ($options['help'] || !isset($profiles[$options['profile']])) {
    echo "Options: --profile=" . implode('|', array_keys($profiles)) . "\n";
    exit($options['help'] ? 0 : 1);
}
$p = $profiles[$options['profile']];

// Dev guard (A-T1-02): the QA oracle has the manager archetype. Make it only on a local dev site (.test host).
$wwwhost = (string) parse_url($CFG->wwwroot, PHP_URL_HOST);
if ($options['profile'] === 'qa_oracle' && !preg_match('/\.test$/', $wwwhost)) {
    cli_error("Refused: the QA oracle is dev/test only, and the wwwroot host '$wwwhost' does not end in .test.");
}

\core\session\manager::set_user(get_admin());

// 1. Web services and the REST protocol.
set_config('enablewebservices', 1);
$protocols = array_filter(explode(',', (string) get_config('core', 'webserviceprotocols')));
if (!in_array('rest', $protocols)) {
    $protocols[] = 'rest';
    set_config('webserviceprotocols', implode(',', $protocols));
}

// 2. Service user (manual auth, random password: it never logs in to the web UI).
$user = $DB->get_record('user', ['username' => $p['username'], 'deleted' => 0]);
if (!$user) {
    $userid = user_create_user((object) [
        'username' => $p['username'], 'auth' => 'manual', 'password' => 'Aa1-' . random_string(24),
        'firstname' => $p['firstname'], 'lastname' => $p['lastname'], 'email' => $p['username'] . '@example.invalid',
        'confirmed' => 1, 'mnethostid' => $CFG->mnet_localhost_id,
    ], true, false);
    $user = $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);
}

// 3. System role.
$sysctx = context_system::instance();
$role = $DB->get_record('role', ['shortname' => $p['role']['shortname']]);
if ($role) {
    $roleid = (int) $role->id;
} else {
    $roleid = create_role($p['role']['name'], $p['role']['shortname'], 'Made by infra/moodle/php/setup_webservices.php.',
        $p['role']['archetype']);
    if ($p['role']['archetype'] !== '') {
        reset_role_capabilities($roleid); // Copy the archetype defaults.
    }
}
set_role_contextlevels($roleid, [CONTEXT_SYSTEM]);
foreach ($p['caps'] as $cap) {
    assign_capability($cap, CAP_ALLOW, $roleid, $sysctx->id, true);
}
foreach ($p['assignroles'] as $target) {
    $targetid = $DB->get_field('role', 'id', ['shortname' => $target], MUST_EXIST);
    if (!$DB->record_exists('role_allow_assign', ['roleid' => $roleid, 'allowassign' => $targetid])) {
        core_role_set_assign_allowed($roleid, $targetid);
    }
}
role_assign($roleid, $user->id, $sysctx->id);

// 4. External service with a function whitelist, restricted to the service user.
$service = $DB->get_record('external_services', ['shortname' => $p['service']['shortname']]);
if (!$service) {
    $now = time();
    $serviceid = $DB->insert_record('external_services', (object) [
        'name' => $p['service']['name'], 'shortname' => $p['service']['shortname'], 'enabled' => 1,
        'restrictedusers' => 1, 'downloadfiles' => 0, 'uploadfiles' => 0, 'timecreated' => $now, 'timemodified' => $now,
    ]);
    $service = $DB->get_record('external_services', ['id' => $serviceid], '*', MUST_EXIST);
}
// No file download or upload through the token (A-T1-02): webservice/pluginfile.php checks only this flag.
// Also fixes services made by an older seed.
if ((int) $service->downloadfiles !== 0 || (int) $service->uploadfiles !== 0 || (int) $service->enabled !== 1 || (int) $service->restrictedusers !== 1) {
    $DB->update_record('external_services', (object) ['id' => $service->id, 'downloadfiles' => 0, 'uploadfiles' => 0,
        'enabled' => 1, 'restrictedusers' => 1, 'timemodified' => time()]);
    $service = $DB->get_record('external_services', ['id' => $service->id], '*', MUST_EXIST);
}
foreach ($p['functions'] as $fn) {
    if (!$DB->record_exists('external_functions', ['name' => $fn])) {
        throw new moodle_exception('unknown function: ' . $fn);
    }
    if (!$DB->record_exists('external_services_functions', ['externalserviceid' => $service->id, 'functionname' => $fn])) {
        $DB->insert_record('external_services_functions', (object) ['externalserviceid' => $service->id, 'functionname' => $fn]);
    }
}
if (!$DB->record_exists('external_services_users', ['externalserviceid' => $service->id, 'userid' => $user->id])) {
    $DB->insert_record('external_services_users', (object) [
        'externalserviceid' => $service->id, 'userid' => $user->id, 'timecreated' => time(),
    ]);
}

// 5. Permanent token (reuse if it exists).
$token = $DB->get_field('external_tokens', 'token', [
    'userid' => $user->id, 'externalserviceid' => $service->id, 'tokentype' => EXTERNAL_TOKEN_PERMANENT, 'name' => $p['tokenname'],
]);
if (!$token) {
    $token = \core_external\util::generate_token(EXTERNAL_TOKEN_PERMANENT, $service, $user->id, $sysctx, 0, '', $p['tokenname']);
}

echo json_encode([
    'profile' => $options['profile'], 'service' => $service->shortname, 'username' => $user->username,
    'userid' => (int) $user->id, 'serviceid' => (int) $service->id, 'token' => $token, 'functions' => $p['functions'],
]) . "\n";
