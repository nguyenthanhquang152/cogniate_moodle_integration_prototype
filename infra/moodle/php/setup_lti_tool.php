<?php
// Register (or update) a site-level, preconfigured LTI 1.3 tool in mod_lti. Active at once (state CONFIGURED).
// Output: one JSON line with the values the tool needs (issuer, client_id, deployment_id, endpoints).
// Run: infra/scripts/moodle-php.sh /opt/cogniate/php/setup_lti_tool.php [--toolbase=https://lti.cogniate.test]
// Defaults follow docs/architecture/contracts/lti-service-api.md (§2.1-2.3). T2 owns the real seed.

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');

[$options] = cli_get_params([
    'name' => 'Cogniate (dev)',
    'toolbase' => (string) getenv('PUBLIC_LTI_URL'), // From .env through compose.
    'launchpath' => '/lti/launch',
    'loginpath' => '/lti/login',
    'jwkspath' => '/lti/keys/cogniate',
    'deeplinkpath' => '/lti/launch',
    'redirectpaths' => '/lti/launch',   // Comma-separated.
    'coursevisible' => '2',             // 0 no, 1 preconfigured list, 2 also in the activity chooser.
    'launchcontainer' => '4',           // 2 embed, 3 embed without blocks, 4 new window.
    'sendname' => '0',                  // Privacy default: do not share name / email (spec COG-MDL-HLS-001).
    'sendemail' => '0',
    'help' => false,
]);
if ($options['help']) {
    echo "Options: --name --toolbase --launchpath --loginpath --jwkspath --deeplinkpath --redirectpaths(csv)\n"
        . "         --coursevisible(0|1|2) --launchcontainer(2|3|4) --sendname(0|1) --sendemail(0|1)\n";
    exit(0);
}

if ($options['toolbase'] === '') {
    cli_error('No tool base URL: set --toolbase or PUBLIC_LTI_URL.');
}
\core\session\manager::set_user(get_admin());

$base = rtrim($options['toolbase'], '/');
$redirects = array_map(fn($p) => $base . trim($p), explode(',', $options['redirectpaths']));

$config = (object) [
    'lti_typename' => $options['name'],
    'lti_toolurl' => $base . $options['launchpath'],
    'lti_description' => 'Cogniate courses over LTI 1.3 (local dev).',
    'lti_ltiversion' => LTI_VERSION_1P3,             // '1.3.0'
    'lti_keytype' => LTI_JWK_KEYSET,                 // 'JWK_KEYSET'
    'lti_publickeyset' => $base . $options['jwkspath'],
    'lti_initiatelogin' => $base . $options['loginpath'],
    'lti_redirectionuris' => implode("\n", $redirects),
    'lti_contentitem' => 1,                           // Deep Linking on.
    'lti_toolurl_ContentItemSelectionRequest' => $base . $options['deeplinkpath'],
    'lti_customparameters' => '',
    'lti_coursevisible' => (int) $options['coursevisible'],
    'lti_launchcontainer' => (int) $options['launchcontainer'],
    'lti_sendname' => (int) $options['sendname'],
    'lti_sendemailaddr' => (int) $options['sendemail'],
    'lti_acceptgrades' => 2,                          // 2 = as specified in the deep linking item / activity.
    'lti_forcessl' => 0,
    'lti_organizationid_default' => LTI_DEFAULT_ORGID_SITEID,
    'lti_organizationid' => '',
    'lti_organizationurl' => '',
    'ltiservice_gradesynchronization' => 2,           // AGS: grade sync + line item management.
    'ltiservice_memberships' => 1,                    // NRPS on.
    'ltiservice_toolsettings' => 0,
];

$existing = $DB->get_record('lti_types', ['name' => $options['name'], 'course' => SITEID]);
if ($existing) {
    $type = (object) ['id' => $existing->id, 'state' => LTI_TOOL_STATE_CONFIGURED, 'clientid' => $existing->clientid];
    $config->lti_clientid = $existing->clientid;
    lti_update_type($type, $config);
    $typeid = (int) $existing->id;
} else {
    $type = (object) ['state' => LTI_TOOL_STATE_CONFIGURED];
    $typeid = (int) lti_add_type($type, $config);
}
$saved = $DB->get_record('lti_types', ['id' => $typeid], '*', MUST_EXIST);
$cfg = lti_get_type_config($typeid);

echo json_encode([
    'typeid' => $typeid,
    'state' => (int) $saved->state,
    'issuer' => $CFG->wwwroot,
    'client_id' => $saved->clientid,
    'deployment_id' => (string) $typeid,
    'auth_url' => $CFG->wwwroot . '/mod/lti/auth.php',
    'token_url' => $CFG->wwwroot . '/mod/lti/token.php',
    'jwks_url' => $CFG->wwwroot . '/mod/lti/certs.php',
    'tool' => [
        'baseurl' => $saved->baseurl, 'tooldomain' => $saved->tooldomain,
        'initiatelogin' => $cfg['initiatelogin'] ?? null, 'redirectionuris' => $cfg['redirectionuris'] ?? null,
        'publickeyset' => $cfg['publickeyset'] ?? null, 'deeplink' => $cfg['toolurl_ContentItemSelectionRequest'] ?? null, 'contentitem' => (int) ($cfg['contentitem'] ?? 0),
        'coursevisible' => (int) $saved->coursevisible, 'launchcontainer' => (int) ($cfg['launchcontainer'] ?? 0),
        'gradesync' => (int) ($cfg['ltiservice_gradesynchronization'] ?? -1),
        'memberships' => (int) ($cfg['ltiservice_memberships'] ?? -1),
        'sendname' => (int) ($cfg['sendname'] ?? -1), 'sendemailaddr' => (int) ($cfg['sendemailaddr'] ?? -1),
    ],
], JSON_UNESCAPED_SLASHES) . "\n";
