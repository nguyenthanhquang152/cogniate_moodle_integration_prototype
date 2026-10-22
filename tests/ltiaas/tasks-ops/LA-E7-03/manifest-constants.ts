export const BASELINE_HOSTS_MANIFEST = {
  version: 1,
  providers: [
    {
      id: 'blackboard-sim',
      aliases: [
        'developer.blackboard.sim.test',
        'learn-a.blackboard.sim.test',
        'learn-b.blackboard.sim.test',
      ],
      allowlist: [
        'developer.blackboard.sim.test',
        'learn-a.blackboard.sim.test',
        'learn-b.blackboard.sim.test',
      ],
    },
    {
      id: 'canvas-sim-cloud',
      aliases: [
        'sso.canvas.sim.test',
        'school-a.canvas.sim.test',
        'school-b.canvas.sim.test',
        'canvas.school-a.sim.test',
      ],
      allowlist: [
        'sso.canvas.sim.test',
        'school-a.canvas.sim.test',
        'school-b.canvas.sim.test',
      ],
    },
    {
      id: 'canvas-sim-self',
      aliases: ['canvas-self.sim.test', 'api.canvas-self.sim.test'],
      allowlist: ['canvas-self.sim.test', 'api.canvas-self.sim.test'],
    },
  ],
};

export const BASELINE_SIM_ALIASES = [
  'lms-sim.test',
  'developer.blackboard.sim.test',
  'learn-a.blackboard.sim.test',
  'learn-b.blackboard.sim.test',
  'sso.canvas.sim.test',
  'school-a.canvas.sim.test',
  'school-b.canvas.sim.test',
  'canvas.school-a.sim.test',
  'canvas-self.sim.test',
  'api.canvas-self.sim.test',
];

export const BASELINE_SIM_ALLOWLIST = [
  'developer.blackboard.sim.test',
  'learn-a.blackboard.sim.test',
  'learn-b.blackboard.sim.test',
  'sso.canvas.sim.test',
  'school-a.canvas.sim.test',
  'school-b.canvas.sim.test',
  'canvas-self.sim.test',
  'api.canvas-self.sim.test',
];

export const BASELINE_QA_CERT_SANS = [
  'evil.test',
  'qa-platform.test',
  ...BASELINE_SIM_ALIASES,
  'lti-gate.test',
];
