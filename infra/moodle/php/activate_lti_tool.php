<?php
// T7 demo:prepare (AC-T7-02 state): activate the tool type of a client id and set "Tool configuration usage" =
// "Show in activity chooser and as a preconfigured tool" and "Default launch container" = "New window", as the
// admin does after a dynamic registration (moodle-steps.json). Idempotent.
// Output: one JSON line {typeid, name, state, coursevisible, launchcontainer}.
// Run: infra/scripts/moodle-php.sh /opt/cogniate/php/activate_lti_tool.php --clientid=<client id>
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');

[$options] = cli_get_params(['clientid' => '', 'help' => false]);
if ($options['help'] || $options['clientid'] === '') {
    echo "Options: --clientid=<LTI 1.3 client id of the tool type>\n";
    exit($options['help'] ? 0 : 1);
}
$type = $DB->get_record('lti_types', ['clientid' => $options['clientid']], '*', MUST_EXIST);
$DB->update_record('lti_types', (object) ['id' => $type->id, 'state' => LTI_TOOL_STATE_CONFIGURED, 'coursevisible' => LTI_COURSEVISIBLE_ACTIVITYCHOOSER, 'timemodified' => time()]);
$config = $DB->get_record('lti_types_config', ['typeid' => $type->id, 'name' => 'launchcontainer']);
if ($config) {
    $DB->set_field('lti_types_config', 'value', (string) LTI_LAUNCH_CONTAINER_WINDOW, ['id' => $config->id]);
} else {
    $DB->insert_record('lti_types_config', (object) ['typeid' => $type->id, 'name' => 'launchcontainer', 'value' => (string) LTI_LAUNCH_CONTAINER_WINDOW]);
}
\cache_helper::purge_by_event('changesinlti');
$t = $DB->get_record('lti_types', ['id' => $type->id]);
echo json_encode(['typeid' => (int) $t->id, 'name' => $t->name, 'state' => (int) $t->state, 'coursevisible' => (int) $t->coursevisible,
    'launchcontainer' => LTI_LAUNCH_CONTAINER_WINDOW], JSON_UNESCAPED_SLASHES) . "\n";
