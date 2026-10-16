<?php
// DEV ONLY. Moodle curl security for the local compose network (README §10, ADR-005).
//  - curlsecurityblockedhosts = the Moodle default list, but the stack subnet (--subnet, from STACK_SUBNET)
//    is cut out of the default block that contains it. Example: 172.16.0.0/12 minus 172.28.0.0/16 =
//    172.16.0.0/13, 172.24.0.0/14, 172.29.0.0/16, 172.30.0.0/15. Only the stack subnet becomes reachable.
//    Loopback, the rest of the private ranges, 0.0.0.0 and the cloud metadata IP stay blocked.
//  - curlsecurityallowedport  = 443 (plus --publicport if it is not 443).
//  - noemailever = 1 (no outgoing mail).
// MoodleCloud does not need this: production tool URLs are public https on port 443.
// Run: infra/scripts/moodle-php.sh /opt/cogniate/php/setup_dev_network.php --subnet=172.28.0.0/16 [--publicport=443]
//      [--restore] [--dry-run]
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');

[$options] = cli_get_params(['subnet' => '', 'publicport' => '443', 'restore' => false, 'dry-run' => false, 'help' => false]);
if ($options['help']) {
    echo "Options: --subnet=CIDR --publicport=443 --restore (Moodle defaults) --dry-run (print only)\n";
    exit(0);
}

/** Parse "a.b.c.d/n" into [network as int, prefix]. Host bits must be zero. */
function cg_parse_cidr(string $cidr): array {
    if (!preg_match('~^(\d{1,3}(?:\.\d{1,3}){3})/(\d{1,2})$~', $cidr, $m) || ($ip = ip2long($m[1])) === false || (int) $m[2] > 32) {
        cli_error("Not an IPv4 CIDR: $cidr");
    }
    $prefix = (int) $m[2];
    $mask = $prefix === 0 ? 0 : (~0 << (32 - $prefix)) & 0xFFFFFFFF;
    if (($ip & $mask) !== $ip) {
        cli_error("CIDR has host bits set: $cidr");
    }
    return [$ip, $prefix];
}

/** $block minus $sub, as a list of CIDRs. $sub must be inside $block. */
function cg_cidr_subtract(string $block, string $sub): array {
    [$bip, $bp] = cg_parse_cidr($block);
    [$sip, $sp] = cg_parse_cidr($sub);
    $out = [];
    while ($bp < $sp) {
        $bp++;
        $half = 1 << (32 - $bp);
        $low = $bip;
        $high = $bip + $half;
        if ($sip >= $high) {
            $out[] = long2ip($low) . '/' . $bp;
            $bip = $high;
        } else {
            $out[] = long2ip($high) . '/' . $bp;
        }
    }
    return $out;
}

function cg_cidr_contains(string $block, string $sub): bool {
    [$bip, $bp] = cg_parse_cidr($block);
    [$sip, $sp] = cg_parse_cidr($sub);
    $mask = $bp === 0 ? 0 : (~0 << (32 - $bp)) & 0xFFFFFFFF;
    return $sp >= $bp && (($sip & $mask) === $bip);
}

$port = (int) $options['publicport'];
if ($port < 1 || $port > 65535) {
    cli_error('--publicport must be a port number');
}
$defaultblocked = ['127.0.0.0/8', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '0.0.0.0', 'localhost',
    '169.254.169.254', '0000::1'];

if ($options['restore']) {
    $blocked = $defaultblocked;
    $ports = ['443', '80'];
} else {
    if ($options['subnet'] === '') {
        cli_error('--subnet is required (the compose subnet, STACK_SUBNET).');
    }
    cg_parse_cidr($options['subnet']);
    $blocked = [];
    $cut = false;
    foreach ($defaultblocked as $entry) {
        if (str_contains($entry, '/') && $entry !== '127.0.0.0/8' && cg_cidr_contains($entry, $options['subnet'])) {
            array_push($blocked, ...cg_cidr_subtract($entry, $options['subnet']));
            $cut = true;
        } else {
            $blocked[] = $entry;
        }
    }
    if (!$cut) {
        cli_error("Subnet {$options['subnet']} is not inside 10.0.0.0/8, 172.16.0.0/12 or 192.168.0.0/16.");
    }
    $ports = array_values(array_unique(['443', (string) $port]));
}

if (!$options['dry-run']) {
    set_config('curlsecurityblockedhosts', implode("\n", $blocked));
    set_config('curlsecurityallowedport', implode("\n", $ports));
    set_config('noemailever', 1);
}
echo '   ' . json_encode([
    'curlsecurityblockedhosts' => $options['dry-run'] ? $blocked : explode("\n", get_config('core', 'curlsecurityblockedhosts')),
    'curlsecurityallowedport' => $options['dry-run'] ? $ports : explode("\n", get_config('core', 'curlsecurityallowedport')),
    'noemailever' => (int) get_config('core', 'noemailever'),
    'dry_run' => (bool) $options['dry-run'],
], JSON_UNESCAPED_SLASHES) . "\n";
