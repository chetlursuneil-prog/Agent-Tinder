// This module handles user registration logic

const registerUser = (userData) => {
  // Validate user data
  if (!userData.email || !userData.password) {
    throw new Error('Email and password are required');
  }

  // Simulate user registration
  console.log('User registered:', userData);

  // Return a success message or user object
  return { success: true, message: 'User registered successfully' };
};

module.exports = { registerUser };