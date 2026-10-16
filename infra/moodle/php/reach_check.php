<?php
// Fetch a URL with Moodle's own HTTP client (download_file_content: curl security checks + CA bundle).
// Prints the response body. Exit 1 if Moodle blocks or cannot fetch the URL.
// Run: npm run stack:moodle-reach-check [-- https://lti.cogniate.test/healthz]
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/filelib.php');

$url = $argv[1] ?? '';
if ($url === '') {
    fwrite(STDERR, "Usage: reach_check.php <url>\n");
    exit(2);
}
$cacert = \curl::get_cacert();
$response = download_file_content($url, null, null, true, 10, 5);
fwrite(STDERR, "url=$url status=" . ($response->status ?? '-') . " cacert=" . ($cacert ?? 'system default') . "\n");
if (!empty($response->error) || (int) ($response->status ?? 0) !== 200) {
    fwrite(STDERR, 'error=' . ($response->error ?? 'HTTP ' . ($response->status ?? '?')) . "\n");
    exit(1);
}
echo $response->results . "\n";
