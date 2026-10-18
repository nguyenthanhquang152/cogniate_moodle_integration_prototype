<?php
// T7 demo:prepare: the first step of Moodle's dynamic registration without a browser. It does exactly what
// mod/lti/startltiadvregistration.php does for "Add LTI Advantage" with a new tool: a registration token
// (scope reg, sub = a new client id, 1 h), signed with the site key, and the tool URL with openid_configuration
// and registration_token. The tool (our LTI service) then reads the configuration and registers itself.
// Output: one JSON line {url}. Run: infra/scripts/moodle-php.sh /opt/cogniate/php/start_lti_registration.php --url=<tool registration URL>
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');

use Firebase\JWT\JWT;
use mod_lti\local\ltiopenid\jwks_helper;
use mod_lti\local\ltiopenid\registration_helper;

[$options] = cli_get_params(['url' => '', 'help' => false]);
// --url=- reads the URL from stdin: it holds the registration ref (a secret), which must not be on a command line.
if ($options['url'] === '-') {
    $options['url'] = trim((string) fgets(STDIN));
}
if ($options['help'] || $options['url'] === '' || !preg_match('#^https://#', $options['url'])) {
    echo "Options: --url=<https tool registration URL> (or --url=- to read it from stdin)\n";
    exit($options['help'] ? 0 : 1);
}
$now = time();
$token = ['sub' => registration_helper::get()->new_clientid(), 'scope' => registration_helper::REG_TOKEN_OP_NEW_REG, 'iat' => $now, 'exp' => $now + HOURSECS];
$privatekey = jwks_helper::get_private_key();
$url = new moodle_url($options['url']);
$url->param('openid_configuration', (new moodle_url('/mod/lti/openid-configuration.php'))->out(false));
$url->param('registration_token', JWT::encode($token, $privatekey['key'], 'RS256', $privatekey['kid']));
echo json_encode(['url' => $url->out(false)], JSON_UNESCAPED_SLASHES) . "\n";
