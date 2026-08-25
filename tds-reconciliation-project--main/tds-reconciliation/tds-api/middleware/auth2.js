/**
 * Standalone bypass authentication middleware
 */
export const authenticateUser = (req, res, next) => {
  // Inject mock user for standalone development and testing
  req.user = {
    id: 1,
    email: 'admin@saarthi.com',
    name: 'Standalone Admin',
    role: 'admin'
  };
  next();
};

export default { authenticateUser };
