// Checks the passwords the seed script gives to its starter accounts.
// In production the seed must not create accounts with public default passwords.
export const SEED_PASSWORD_VARS = ['SEED_ADMIN_PASSWORD', 'SEED_EXPERT_PASSWORD', 'SEED_STUDENT_PASSWORD'];
export const MIN_SEED_PASSWORD_LENGTH = 12;

// The defaults the seed uses when a variable is not set. They are written in the source code.
const KNOWN_DEFAULTS = new Set(['dev_admin_password', 'dev_expert_password', 'dev_student_password']);

// Returns one message per problem. An empty list means the seed may run.
// Only NODE_ENV set to exactly development or test allows the defaults. Any other value, and an unset
// one, must give strong passwords of its own.
// The messages name the variable and never its value.
export function seedPasswordProblems(env = process.env) {
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') return [];
  const problems = [];
  for (const name of SEED_PASSWORD_VARS) {
    const value = env[name] ?? '';
    if (value.trim().length < MIN_SEED_PASSWORD_LENGTH) {
      problems.push(`${name} must be set to at least ${MIN_SEED_PASSWORD_LENGTH} characters.`);
    } else if (KNOWN_DEFAULTS.has(value)) {
      problems.push(`${name} must not be one of the public default passwords.`);
    }
  }
  return problems;
}
