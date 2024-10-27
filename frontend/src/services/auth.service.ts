// src/services/auth.service.ts
interface RegisterModel {
    username: string;
    email: string;
    password: string;
  }
  
  interface LoginModel {
    username: string;
    password: string;
  }
  
  const API_URL = "http://localhost:5001/api/auth";
  
  export const authService = {
    async register(data: RegisterModel) {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Registration failed');
      }
      
      return response.json();
    },
  
    async login(data: LoginModel) {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Login failed');
      }
      
      const result = await response.json();
      // Store the token if it's returned
      if (result.token) {
        localStorage.setItem('token', result.token);
      }
      return result;
    }
  };