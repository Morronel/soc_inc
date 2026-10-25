// SOC Inc. — real-world labels
//
// Every capability in the defense tree carries the MITRE ATT&CK mitigation (Mxxxx), data source (DSxxxx)
// or framework it stands for. Edit freely: anything left empty is simply not shown.
// Labels appear in the DEFENSE tree, in the SOC console and on the end-of-run report.
window.SI = window.SI || {};

SI.LABELS = {
  upgrades: {
    // DETECT
    dt_siem:     { id: 'M1047', name: 'Audit' },
    dt_sysmon:   { id: 'DS0009', name: 'Process (data source)' },
    dt_ndr:      { id: 'DS0029', name: 'Network Traffic (data source)' },
    dt_sigma:    { id: '', name: 'Detection-as-Code (Sigma)' },
    dt_edr:      { id: 'M1040', name: 'Behavior Prevention on Endpoint' },
    dt_dns:      { id: 'DS0038', name: 'Domain Name (data source)' },
    dt_canary:   { id: '', name: 'MITRE D3FEND · Deceive' },
    dt_ueba:     { id: 'DS0028', name: 'Logon Session (data source)' },
    dt_hunt:     { id: '', name: 'Threat hunting (PEAK)' },
    dt_xdr:      { id: '', name: 'Cross-domain correlation' },
    // PROTECT
    pr_assets:   { id: 'M1016', name: 'Vulnerability Scanning' },
    pr_patch:    { id: 'M1051', name: 'Update Software' },
    pr_mfa:      { id: 'M1032', name: 'Multi-factor Authentication' },
    pr_email:    { id: 'M1054', name: 'Software Configuration' },
    pr_laps:     { id: 'M1043', name: 'Credential Access Protection' },
    pr_fido:     { id: 'M1032', name: 'Multi-factor Authentication' },
    pr_asr:      { id: 'M1038', name: 'Execution Prevention' },
    pr_tier:     { id: 'M1026', name: 'Privileged Account Management' },
    pr_seg:      { id: 'M1030', name: 'Network Segmentation' },
    pr_jit:      { id: 'M1026', name: 'Privileged Account Management' },
    pr_zt:       { id: 'M1035', name: 'Limit Access to Resource Over Network' },
    // RESPOND
    rs_playbook: { id: '', name: 'NIST SP 800-61' },
    rs_isolate:  { id: '', name: 'MITRE D3FEND · Isolate' },
    rs_dfir:     { id: '', name: 'Digital forensics & incident response' },
    rs_soar:     { id: '', name: 'Security orchestration (SOAR)' },
    rs_egress:   { id: 'M1037', name: 'Filter Network Traffic' },
    rs_memory:   { id: '', name: 'Memory forensics' },
    rs_krbtgt:   { id: 'M1015', name: 'Active Directory Configuration' },
    rs_intel:    { id: 'M1019', name: 'Threat Intelligence Program' },
    rs_purple:   { id: '', name: 'Adversary emulation' },
    rs_evict:    { id: '', name: 'MITRE D3FEND · Evict' },
    // GOVERN & RECOVER
    gv_board:    { id: '', name: 'NIST CSF 2.0 · GV.RM' },
    gv_aware:    { id: 'M1017', name: 'User Training' },
    gv_backup:   { id: 'M1053', name: 'Data Backup' },
    gv_tabletop: { id: '', name: 'Incident response exercises' },
    gv_insure:   { id: '', name: 'Risk transfer' },
    gv_immutable:{ id: 'M1053', name: 'Data Backup' },
    gv_mssp:     { id: '', name: 'Managed detection & response' },
    gv_dlp:      { id: 'M1057', name: 'Data Loss Prevention' },
    gv_dr:       { id: '', name: 'MITRE D3FEND · Restore' },
    gv_wellness: { id: '', name: 'SOC sustainability' },
    gv_nis2:     { id: '', name: 'NIS2 · DORA' }
  }
};

// ATT&CK technique names for every technique ID referenced anywhere in the game.
SI.TECH_NAMES = {
  'T1059': 'Command and Scripting Interpreter', 'T1204': 'User Execution', 'T1036': 'Masquerading',
  'T1550': 'Use Alternate Authentication Material', 'T1055': 'Process Injection', 'T1098': 'Account Manipulation',
  'T1566': 'Phishing', 'T1190': 'Exploit Public-Facing Application', 'T1133': 'External Remote Services',
  'T1091': 'Replication Through Removable Media', 'T1195': 'Supply Chain Compromise', 'T1078': 'Valid Accounts'
};
SI.techName = function (id) {
  var t = SI.TTPS && SI.TTPS[id];
  if (t) return SI.L(t.name);
  return SI.TECH_NAMES[id] || '';
};

// Returns { id, name } when at least one field is filled, otherwise null.
SI.label = function (kind, key) {
  var group = SI.LABELS && SI.LABELS[kind], l = group && group[key];
  if (!l || (!l.id && !l.name)) return null;
  return l;
};
SI.labelText = function (kind, key) {
  var l = SI.label(kind, key);
  if (!l) return '';
  return [l.id, l.name].filter(Boolean).join(' · ');
};
