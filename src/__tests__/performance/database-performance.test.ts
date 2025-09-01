import { DatabaseManager } from '@/lib/database/connection';
import { performance } from 'perf_hooks';

describe('Database Performance Benchmarks', () => {
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    dbManager = DatabaseManager.getInstance();
    await dbManager.initialize(':memory:'); // Use in-memory database for tests
  });

  afterEach(async () => {
    await dbManager.close();
  });

  describe('Query Performance', () => {
    it('should execute simple SELECT queries within performance threshold', async () => {
      // Setup test data
      await dbManager.executeQuery(`
        CREATE TABLE performance_test (
          id INTEGER PRIMARY KEY,
          name TEXT,
          value INTEGER
        )
      `);

      // Insert test data
      const insertPromises = [];
      for (let i = 0; i < 1000; i++) {
        insertPromises.push(
          dbManager.executeQuery(
            'INSERT INTO performance_test (name, value) VALUES (?, ?)',
            [`name_${i}`, i]
          )
        );
      }
      await Promise.all(insertPromises);

      // Benchmark simple SELECT
      const startTime = performance.now();
      const result = await dbManager.executeQuery('SELECT * FROM performance_test LIMIT 100');
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      expect(result.rows).toHaveLength(100);
      expect(executionTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should execute complex JOINs within performance threshold', async () => {
      // Setup test schema
      await dbManager.executeQuery(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT,
          email TEXT
        )
      `);

      await dbManager.executeQuery(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          title TEXT,
          content TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Insert test data
      for (let i = 0; i < 100; i++) {
        await dbManager.executeQuery(
          'INSERT INTO users (name, email) VALUES (?, ?)',
          [`User ${i}`, `user${i}@test.com`]
        );
      }

      for (let i = 0; i < 500; i++) {
        await dbManager.executeQuery(
          'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)',
          [Math.floor(i / 5) + 1, `Post ${i}`, `Content for post ${i}`]
        );
      }

      // Benchmark complex JOIN
      const startTime = performance.now();
      const result = await dbManager.executeQuery(`
        SELECT u.name, u.email, COUNT(p.id) as post_count
        FROM users u
        LEFT JOIN posts p ON u.id = p.user_id
        GROUP BY u.id, u.name, u.email
        ORDER BY post_count DESC
      `);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      expect(result.rows).toHaveLength(100);
      expect(executionTime).toBeLessThan(200); // Should complete within 200ms
    });

    it('should handle large result sets efficiently', async () => {
      await dbManager.executeQuery(`
        CREATE TABLE large_test (
          id INTEGER PRIMARY KEY,
          data TEXT
        )
      `);

      // Insert 10,000 rows
      const batchSize = 100;
      for (let batch = 0; batch < 100; batch++) {
        const values = [];
        for (let i = 0; i < batchSize; i++) {
          values.push(`('data_${batch * batchSize + i}')`);
        }
        await dbManager.executeQuery(
          `INSERT INTO large_test (data) VALUES ${values.join(', ')}`
        );
      }

      // Benchmark large result set
      const startTime = performance.now();
      const result = await dbManager.executeQuery('SELECT * FROM large_test LIMIT 5000');
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      expect(result.rows).toHaveLength(5000);
      expect(executionTime).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Connection Performance', () => {
    it('should initialize database connection quickly', async () => {
      const newDbManager = DatabaseManager.getInstance();
      
      const startTime = performance.now();
      await newDbManager.initialize(':memory:');
      const endTime = performance.now();

      const initTime = endTime - startTime;
      expect(initTime).toBeLessThan(1000); // Should initialize within 1 second
    });

    it('should handle concurrent queries efficiently', async () => {
      await dbManager.executeQuery(`
        CREATE TABLE concurrent_test (
          id INTEGER PRIMARY KEY,
          thread_id INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const concurrentQueries = 50;
      const queries = [];

      const startTime = performance.now();
      
      for (let i = 0; i < concurrentQueries; i++) {
        queries.push(
          dbManager.executeQuery(
            'INSERT INTO concurrent_test (thread_id) VALUES (?)',
            [i]
          )
        );
      }

      await Promise.all(queries);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentQueries;

      expect(averageTime).toBeLessThan(20); // Average query should complete within 20ms
      
      // Verify all queries completed
      const result = await dbManager.executeQuery('SELECT COUNT(*) as count FROM concurrent_test');
      expect(result.rows[0].count).toBe(concurrentQueries);
    });
  });

  describe('Memory Performance', () => {
    it('should not cause memory leaks during repeated operations', async () => {
      await dbManager.executeQuery(`
        CREATE TABLE memory_test (
          id INTEGER PRIMARY KEY,
          data TEXT
        )
      `);

      const initialMemory = process.memoryUsage();
      
      // Perform 1000 insert operations
      for (let i = 0; i < 1000; i++) {
        await dbManager.executeQuery(
          'INSERT INTO memory_test (data) VALUES (?)',
          [`data_${i}`]
        );
        
        // Clean up periodically to avoid accumulation
        if (i % 100 === 0) {
          await dbManager.executeQuery('DELETE FROM memory_test WHERE id < ?', [i - 50]);
        }
      }

      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });

  describe('Transaction Performance', () => {
    it('should execute transactions efficiently', async () => {
      await dbManager.executeQuery(`
        CREATE TABLE transaction_test (
          id INTEGER PRIMARY KEY,
          balance DECIMAL(10,2)
        )
      `);

      // Insert initial data
      await dbManager.executeQuery(
        'INSERT INTO transaction_test (balance) VALUES (?), (?)',
        [1000.00, 2000.00]
      );

      const startTime = performance.now();
      
      // Simulate multiple transactions
      for (let i = 0; i < 100; i++) {
        await dbManager.executeScript(`
          BEGIN TRANSACTION;
          UPDATE transaction_test SET balance = balance - 10.00 WHERE id = 1;
          UPDATE transaction_test SET balance = balance + 10.00 WHERE id = 2;
          COMMIT;
        `);
      }

      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const averageTransactionTime = totalTime / 100;

      expect(averageTransactionTime).toBeLessThan(10); // Each transaction should complete within 10ms

      // Verify final balances are correct
      const result = await dbManager.executeQuery('SELECT * FROM transaction_test ORDER BY id');
      expect(result.rows[0].balance).toBe(0.00);
      expect(result.rows[1].balance).toBe(3000.00);
    });
  });

  describe('Index Performance', () => {
    it('should show improved performance with indexes', async () => {
      await dbManager.executeQuery(`
        CREATE TABLE index_test (
          id INTEGER PRIMARY KEY,
          searchable_field TEXT,
          data TEXT
        )
      `);

      // Insert test data
      for (let i = 0; i < 10000; i++) {
        await dbManager.executeQuery(
          'INSERT INTO index_test (searchable_field, data) VALUES (?, ?)',
          [`field_${i % 1000}`, `data_${i}`]
        );
      }

      // Benchmark without index
      const startTimeNoIndex = performance.now();
      await dbManager.executeQuery(
        "SELECT * FROM index_test WHERE searchable_field = 'field_500'"
      );
      const endTimeNoIndex = performance.now();
      const timeWithoutIndex = endTimeNoIndex - startTimeNoIndex;

      // Create index
      await dbManager.executeQuery(
        'CREATE INDEX idx_searchable_field ON index_test (searchable_field)'
      );

      // Benchmark with index
      const startTimeWithIndex = performance.now();
      await dbManager.executeQuery(
        "SELECT * FROM index_test WHERE searchable_field = 'field_500'"
      );
      const endTimeWithIndex = performance.now();
      const timeWithIndex = endTimeWithIndex - startTimeWithIndex;

      // Index should provide significant performance improvement
      expect(timeWithIndex).toBeLessThan(timeWithoutIndex * 0.8); // At least 20% improvement
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid-fire queries without degradation', async () => {
      await dbManager.executeQuery(`
        CREATE TABLE stress_test (
          id INTEGER PRIMARY KEY,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const queryTimes: number[] = [];
      const numQueries = 1000;

      for (let i = 0; i < numQueries; i++) {
        const startTime = performance.now();
        await dbManager.executeQuery('INSERT INTO stress_test DEFAULT VALUES');
        const endTime = performance.now();
        
        queryTimes.push(endTime - startTime);
      }

      // Calculate performance metrics
      const averageTime = queryTimes.reduce((a, b) => a + b, 0) / numQueries;
      const maxTime = Math.max(...queryTimes);
      const minTime = Math.min(...queryTimes);

      expect(averageTime).toBeLessThan(5); // Average query time should be under 5ms
      expect(maxTime).toBeLessThan(50); // Even the slowest query should be under 50ms
      
      // Performance should not degrade significantly over time
      const firstHalfAvg = queryTimes.slice(0, numQueries / 2).reduce((a, b) => a + b, 0) / (numQueries / 2);
      const secondHalfAvg = queryTimes.slice(numQueries / 2).reduce((a, b) => a + b, 0) / (numQueries / 2);
      
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 2); // Performance should not degrade more than 2x
    });
  });
});