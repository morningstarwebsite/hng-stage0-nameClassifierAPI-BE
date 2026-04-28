export function userHasAnyRole(user, roles) {
  return Boolean(user && roles.includes(user.role));
}
