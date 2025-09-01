import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AuthBridge } from '../../lib/auth/AuthBridge';
import { DatabaseManager } from '../../lib/database/connection';
import { rlsEnforcer } from '../../lib/auth/rls-enforcer';

describe('Row Level Security (RLS) Workflow Integration', () => {
  let authBridge: AuthBridge;
  let dbManager: DatabaseManager;

  // Test users
  const user1 = {
    email: 'user1@example.com',
    password: 'Password123$',
    data: { name: 'User One' }
  };

  const user2 = {
    email: 'user2@example.com',
    password: 'password456',
    data: { name: 'User Two' }
  };

  let user1Id: string;
  let user2Id: string;
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    // Initialize database and auth
    dbManager = DatabaseManager.getInstance();
    await dbManager.initialize();

    authBridge = AuthBridge.getInstance();
    await authBridge.initialize();

    // Create test table with RLS policy
    await dbManager.exec(`
      CREATE TABLE IF NOT EXISTS test_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id),
        title TEXT NOT NULL,
        content TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Enable RLS on the table
    await dbManager.exec(`ALTER TABLE test_posts ENABLE ROW LEVEL SECURITY;`);

    // Create policy: users can only see their own posts
    await dbManager.exec(`
      DROP POLICY IF EXISTS "Users can only see own posts" ON test_posts;
      CREATE POLICY "Users can only see own posts" ON test_posts
        FOR ALL USING (auth.uid() = user_id);
    `);

    // Create policy for insert
    await dbManager.exec(`
      DROP POLICY IF EXISTS "Users can create own posts" ON test_posts;
      CREATE POLICY "Users can create own posts" ON test_posts
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    `);
  });

  afterAll(async () => {
    // Clean up
    try {
      await dbManager.exec('DROP TABLE IF EXISTS test_posts;');
    } catch (error) {
      // Ignore cleanup errors
    }
    await dbManager.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await dbManager.exec('DELETE FROM test_posts;');
    await dbManager.exec(`DELETE FROM auth.users WHERE email IN ($1, $2);`, [user1.email, user2.email]);
    await dbManager.exec(`DELETE FROM auth.sessions;`);

    // Register and sign in both users
    const user1SignupRequest = {
      endpoint: '/auth/v1/signup',
      method: 'POST' as const,
      body: user1,
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'test-anon-key'
      },
      url: new URL('http://localhost:5173/auth/v1/signup')
    };

    const user2SignupRequest = {
      endpoint: '/auth/v1/signup',
      method: 'POST' as const,
      body: user2,
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'test-anon-key'
      },
      url: new URL('http://localhost:5173/auth/v1/signup')
    };

    const user1SignupResponse = await authBridge.handleRequest(user1SignupRequest);
    const user2SignupResponse = await authBridge.handleRequest(user2SignupRequest);

    user1Id = user1SignupResponse.data.user.id;
    user2Id = user2SignupResponse.data.user.id;

    // Sign in both users to get tokens
    const user1SigninRequest = {
      endpoint: '/auth/v1/token',
      method: 'POST' as const,
      body: {
        grant_type: 'password',
        email: user1.email,
        password: user1.password
      },
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'test-anon-key'
      },
      url: new URL('http://localhost:5173/auth/v1/token')
    };

    const user2SigninRequest = {
      endpoint: '/auth/v1/token',
      method: 'POST' as const,
      body: {
        grant_type: 'password',
        email: user2.email,
        password: user2.password
      },
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'test-anon-key'
      },
      url: new URL('http://localhost:5173/auth/v1/token')
    };

    const user1SigninResponse = await authBridge.handleRequest(user1SigninRequest);
    const user2SigninResponse = await authBridge.handleRequest(user2SigninRequest);

    user1Token = user1SigninResponse.data.session.access_token;
    user2Token = user2SigninResponse.data.session.access_token;
  });

  describe('RLS Policy Enforcement', () => {
    it('should allow users to create their own posts', async () => {
      // Set user1 context
      const user1Context = {
        role: 'authenticated' as const,
        userId: user1Id,
        claims: { sub: user1Id, role: 'authenticated' }
      };

      await dbManager.setSessionContext(user1Context);

      // User1 creates a post
      const result = await dbManager.query(
        'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3) RETURNING *',
        [user1Id, 'User 1 Post', 'This is user 1\'s post']
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_id).toBe(user1Id);
      expect(result.rows[0].title).toBe('User 1 Post');
    });

    it('should prevent users from creating posts for other users', async () => {
      // Set user1 context
      const user1Context = {
        role: 'authenticated' as const,
        userId: user1Id,
        claims: { sub: user1Id, role: 'authenticated' }
      };

      await dbManager.setSessionContext(user1Context);

      // User1 tries to create a post for user2 - should fail
      await expect(
        dbManager.query(
          'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)',
          [user2Id, 'Malicious Post', 'User1 trying to post as user2']
        )
      ).rejects.toThrow();
    });

    it('should allow users to see only their own posts', async () => {
      // Create posts for both users directly (bypass RLS for setup)
      await dbManager.exec('SET LOCAL role TO service_role;');
      await dbManager.query(
        'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)',
        [user1Id, 'User 1 Post', 'Content from user 1']
      );
      await dbManager.query(
        'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)',
        [user2Id, 'User 2 Post', 'Content from user 2']
      );
      await dbManager.exec('RESET role;');

      // Set user1 context and query posts
      const user1Context = {
        role: 'authenticated' as const,
        userId: user1Id,
        claims: { sub: user1Id, role: 'authenticated' }
      };

      await dbManager.setSessionContext(user1Context);

      const user1Posts = await dbManager.query('SELECT * FROM test_posts;');
      expect(user1Posts.rows).toHaveLength(1);
      expect(user1Posts.rows[0].user_id).toBe(user1Id);
      expect(user1Posts.rows[0].title).toBe('User 1 Post');

      // Set user2 context and query posts
      const user2Context = {
        role: 'authenticated' as const,
        userId: user2Id,
        claims: { sub: user2Id, role: 'authenticated' }
      };

      await dbManager.setSessionContext(user2Context);

      const user2Posts = await dbManager.query('SELECT * FROM test_posts;');
      expect(user2Posts.rows).toHaveLength(1);
      expect(user2Posts.rows[0].user_id).toBe(user2Id);
      expect(user2Posts.rows[0].title).toBe('User 2 Post');
    });

    it('should prevent users from updating other users posts', async () => {
      // Create a post for user2
      await dbManager.exec('SET LOCAL role TO service_role;');
      const postResult = await dbManager.query(
        'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3) RETURNING id',
        [user2Id, 'User 2 Post', 'Original content']
      );
      const postId = postResult.rows[0].id;
      await dbManager.exec('RESET role;');

      // Set user1 context
      const user1Context = {
        role: 'authenticated' as const,
        userId: user1Id,
        claims: { sub: user1Id, role: 'authenticated' }
      };

      await dbManager.setSessionContext(user1Context);

      // User1 tries to update user2's post - should have no effect due to RLS
      const updateResult = await dbManager.query(
        'UPDATE test_posts SET title = $1, content = $2 WHERE id = $3',
        ['Hacked Title', 'Hacked content', postId]
      );

      // No rows should be updated because RLS prevents access
      expect(updateResult.rowCount).toBe(0);

      // Verify post is unchanged
      await dbManager.exec('SET LOCAL role TO service_role;');
      const verifyResult = await dbManager.query('SELECT * FROM test_posts WHERE id = $1', [postId]);
      expect(verifyResult.rows[0].title).toBe('User 2 Post');
      expect(verifyResult.rows[0].content).toBe('Original content');
      await dbManager.exec('RESET role;');
    });

    it('should prevent users from deleting other users posts', async () => {
      // Create a post for user2
      await dbManager.exec('SET LOCAL role TO service_role;');
      const postResult = await dbManager.query(
        'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3) RETURNING id',
        [user2Id, 'User 2 Post', 'Content to protect']
      );
      const postId = postResult.rows[0].id;
      await dbManager.exec('RESET role;');

      // Set user1 context
      const user1Context = {
        role: 'authenticated' as const,
        userId: user1Id,
        claims: { sub: user1Id, role: 'authenticated' }
      };

      await dbManager.setSessionContext(user1Context);

      // User1 tries to delete user2's post - should have no effect due to RLS
      const deleteResult = await dbManager.query(
        'DELETE FROM test_posts WHERE id = $1',
        [postId]
      );

      // No rows should be deleted because RLS prevents access
      expect(deleteResult.rowCount).toBe(0);

      // Verify post still exists
      await dbManager.exec('SET LOCAL role TO service_role;');
      const verifyResult = await dbManager.query('SELECT * FROM test_posts WHERE id = $1', [postId]);
      expect(verifyResult.rows).toHaveLength(1);
      await dbManager.exec('RESET role;');
    });
  });

  describe('Anonymous vs Authenticated Access', () => {
    it('should prevent anonymous users from accessing protected data', async () => {
      // Create a post as user1
      const user1Context = {
        role: 'authenticated' as const,
        userId: user1Id,
        claims: { sub: user1Id, role: 'authenticated' }
      };

      await dbManager.setSessionContext(user1Context);
      await dbManager.query(
        'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)',
        [user1Id, 'Protected Post', 'Only user1 should see this']
      );

      // Clear session context (simulate anonymous access)
      await dbManager.clearSessionContext();

      // Anonymous user tries to access posts - should see nothing
      const anonResult = await dbManager.query('SELECT * FROM test_posts;');
      expect(anonResult.rows).toHaveLength(0);
    });

    it('should enforce different policies for anon vs authenticated roles', async () => {
      // Set anonymous context
      const anonContext = {
        role: 'anon' as const,
        claims: { role: 'anon', iss: 'supabase-lite' }
      };

      await dbManager.setSessionContext(anonContext);

      // Anonymous users should not be able to insert
      await expect(
        dbManager.query(
          'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)',
          [user1Id, 'Anon Post', 'Anonymous post attempt']
        )
      ).rejects.toThrow();

      // Anonymous users should not see any posts
      const anonSelectResult = await dbManager.query('SELECT * FROM test_posts;');
      expect(anonSelectResult.rows).toHaveLength(0);
    });
  });

  describe('Service Role Bypass', () => {
    it('should allow service role to bypass RLS policies', async () => {
      // Create posts for both users using service role
      const serviceContext = {
        role: 'service_role' as const,
        claims: { role: 'service_role', iss: 'supabase-lite' }
      };

      await dbManager.setSessionContext(serviceContext);

      // Service role can create posts for any user
      await dbManager.query(
        'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)',
        [user1Id, 'Admin Post for User1', 'Created by service role']
      );
      await dbManager.query(
        'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)',
        [user2Id, 'Admin Post for User2', 'Also created by service role']
      );

      // Service role can see all posts
      const allPosts = await dbManager.query('SELECT * FROM test_posts ORDER BY title;');
      expect(allPosts.rows).toHaveLength(2);
      expect(allPosts.rows[0].title).toBe('Admin Post for User1');
      expect(allPosts.rows[1].title).toBe('Admin Post for User2');

      // Service role can update any post
      const updateResult = await dbManager.query(
        'UPDATE test_posts SET content = $1 WHERE user_id = $2',
        ['Updated by service role', user1Id]
      );
      expect(updateResult.rowCount).toBe(1);

      // Service role can delete any post
      const deleteResult = await dbManager.query(
        'DELETE FROM test_posts WHERE user_id = $1',
        [user2Id]
      );
      expect(deleteResult.rowCount).toBe(1);

      // Verify only user1's post remains
      const remainingPosts = await dbManager.query('SELECT * FROM test_posts;');
      expect(remainingPosts.rows).toHaveLength(1);
      expect(remainingPosts.rows[0].user_id).toBe(user1Id);
    });
  });

  describe('Complex RLS Scenarios', () => {
    it('should handle context switching within same session', async () => {
      // Start as user1
      const user1Context = {
        role: 'authenticated' as const,
        userId: user1Id,
        claims: { sub: user1Id, role: 'authenticated' }
      };

      await dbManager.setSessionContext(user1Context);
      await dbManager.query(
        'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)',
        [user1Id, 'User1 Post', 'Posted as user1']
      );

      // Switch to user2 context
      const user2Context = {
        role: 'authenticated' as const,
        userId: user2Id,
        claims: { sub: user2Id, role: 'authenticated' }
      };

      await dbManager.setSessionContext(user2Context);
      await dbManager.query(
        'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)',
        [user2Id, 'User2 Post', 'Posted as user2']
      );

      // User2 should only see their own post
      const user2Posts = await dbManager.query('SELECT * FROM test_posts;');
      expect(user2Posts.rows).toHaveLength(1);
      expect(user2Posts.rows[0].title).toBe('User2 Post');

      // Switch back to user1
      await dbManager.setSessionContext(user1Context);
      const user1Posts = await dbManager.query('SELECT * FROM test_posts;');
      expect(user1Posts.rows).toHaveLength(1);
      expect(user1Posts.rows[0].title).toBe('User1 Post');
    });

    it('should handle concurrent user contexts safely', async () => {
      // This test verifies that the RLS context is properly isolated
      // In a real concurrent scenario, each connection would have its own context

      const user1Context = {
        role: 'authenticated' as const,
        userId: user1Id,
        claims: { sub: user1Id, role: 'authenticated' }
      };

      const user2Context = {
        role: 'authenticated' as const,
        userId: user2Id,
        claims: { sub: user2Id, role: 'authenticated' }
      };

      // Simulate rapid context switching
      await dbManager.setSessionContext(user1Context);
      await dbManager.query('INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)', [user1Id, 'Post 1', 'Content 1']);

      await dbManager.setSessionContext(user2Context);
      await dbManager.query('INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)', [user2Id, 'Post 2', 'Content 2']);

      await dbManager.setSessionContext(user1Context);
      await dbManager.query('INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)', [user1Id, 'Post 3', 'Content 3']);

      // Each user should still only see their own posts
      await dbManager.setSessionContext(user1Context);
      const user1Posts = await dbManager.query('SELECT * FROM test_posts ORDER BY title;');
      expect(user1Posts.rows).toHaveLength(2);
      expect(user1Posts.rows.every(post => post.user_id === user1Id)).toBe(true);

      await dbManager.setSessionContext(user2Context);
      const user2Posts = await dbManager.query('SELECT * FROM test_posts ORDER BY title;');
      expect(user2Posts.rows).toHaveLength(1);
      expect(user2Posts.rows[0].user_id).toBe(user2Id);
    });
  });

  describe('RLS Error Handling', () => {
    it('should handle invalid context gracefully', async () => {
      const invalidContext = {
        role: 'authenticated' as const,
        userId: 'invalid-uuid',
        claims: { sub: 'invalid-uuid', role: 'authenticated' }
      };

      await dbManager.setSessionContext(invalidContext);

      // Queries should still work but return no results due to RLS
      const result = await dbManager.query('SELECT * FROM test_posts;');
      expect(result.rows).toHaveLength(0);
    });

    it('should handle missing context appropriately', async () => {
      await dbManager.clearSessionContext();

      // Without proper context, RLS should block access
      const result = await dbManager.query('SELECT * FROM test_posts;');
      expect(result.rows).toHaveLength(0);

      // Insert should fail without proper context
      await expect(
        dbManager.query(
          'INSERT INTO test_posts (user_id, title, content) VALUES ($1, $2, $3)',
          [user1Id, 'Test', 'Test content']
        )
      ).rejects.toThrow();
    });
  });
});