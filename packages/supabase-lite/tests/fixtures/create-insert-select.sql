-- Create a test table
CREATE TABLE IF NOT EXISTS test_users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO test_users (name, email) VALUES 
  ('Alice Johnson', 'alice@example.com'),
  ('Bob Smith', 'bob@example.com'),
  ('Charlie Brown', 'charlie@example.com');

-- Query the inserted data
SELECT 
  id, 
  name, 
  email, 
  created_at 
FROM test_users 
ORDER BY id;

-- Count total users
SELECT COUNT(*) as total_users FROM test_users;