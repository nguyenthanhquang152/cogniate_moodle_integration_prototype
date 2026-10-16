<?php
// Moodle's own HTTP client, two checks (AC-T1-05, A-T1-06):
//  1. Positive: download_file_content(<url>) with Moodle's curl security and CA bundle. Prints the body.
//  2. Negative: the dev curl rules stay strict. Each URL below must be BLOCKED by Moodle's curl security
//     (curl_security_helper::url_is_blocked, the check that download_file_content uses).
//     Host cases use https (port 443, an allowed port), so they test the HOST block list (A-T1-08):
//       cloud metadata IP, loopback, 10/8, the Docker Desktop host (192.168.65.254), another Docker range
//       (172.17.0.1, or 172.18.0.1 if 172.17.0.1 is inside the stack subnet).
//     Port cases test the PORT rule: port 80 on a stack host, the database port.
// Exit 0 only if the positive URL gives 200 and every negative case is blocked.
// Run: npm run stack:moodle-reach-check [-- <url>]   Args: <url> [--subnet=CIDR]
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/filelib.php');
require_once($CFG->libdir . '/clilib.php');

[$options, $rest] = cli_get_params(['subnet' => '']);
$url = $rest[0] ?? '';
if ($url === '') {
    fwrite(STDERR, "Usage: reach_check.php <url> [--subnet=CIDR]\n");
    exit(2);
}

function cg_in_cidr(string $ip, string $cidr): bool {
    if (!preg_match('~^([\d.]+)/(\d+)$~', $cidr, $m)) {
        return false;
    }
    $mask = (int) $m[2] === 0 ? 0 : (~0 << (32 - (int) $m[2])) & 0xFFFFFFFF;
    return ((ip2long($ip) & $mask) === (ip2long($m[1]) & $mask));
}

$ok = true;

// 1. Positive.
$cacert = \curl::get_cacert();
$response = download_file_content($url, null, null, true, 10, 5);
fwrite(STDERR, "url=$url status=" . ($response->status ?? '-') . " cacert=" . ($cacert ?? 'system default') . "\n");
if (!empty($response->error) || (int) ($response->status ?? 0) !== 200) {
    fwrite(STDERR, 'error=' . ($response->error ?? 'HTTP ' . ($response->status ?? '?')) . "\n");
    $ok = false;
} else {
    echo $response->results . "\n";
}

// 2. Negative.
$docker = cg_in_cidr('172.17.0.1', $options['subnet']) ? '172.18.0.1' : '172.17.0.1';
$host = (string) parse_url($url, PHP_URL_HOST);
$negative = [
    'https://169.254.169.254/' => 'host rule: cloud metadata IP',
    'https://127.0.0.1/' => 'host rule: loopback',
    'https://10.0.0.1/' => 'host rule: 10.0.0.0/8',
    'https://192.168.65.254/' => 'host rule: Docker Desktop host',
    "https://$docker/" => 'host rule: another Docker range',
    "http://$host:80/" => 'port rule: port 80 on a stack host',
    'http://postgres:5432/' => 'port rule: database port',
];
$helper = new \core\files\curl_security_helper();
foreach ($negative as $neg => $why) {
    if ($helper->url_is_blocked($neg)) {
        fwrite(STDERR, "BLOCKED  $neg ($why)\n");
    } else {
        fwrite(STDERR, "ALLOWED  $neg ($why) - the dev curl rules are too wide\n");
        $ok = false;
    }
}
exit($ok ? 0 : 1);
