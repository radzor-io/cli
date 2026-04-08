import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { readConfig, writeConfig, configExists, RadzorConfig } from '../src/utils/config.js';

// Mock dependencies
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe('Config Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('configExists() returns true when radzor.json exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    expect(configExists()).toBe(true);
    // Since cwd is mocked indirectly, we just care that it called existsSync
    expect(fs.existsSync).toHaveBeenCalledTimes(1);
  });

  it('configExists() returns false when radzor.json is missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(configExists()).toBe(false);
  });

  it('readConfig() parses and returns the config successfully', async () => {
    const mockConfig: RadzorConfig = {
      $schema: 'https://radzor.io/schema/config',
      componentDir: 'custom/dir',
      registry: 'https://test.io',
    };
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify(mockConfig));
    
    const config = await readConfig();
    
    expect(config).toEqual(mockConfig);
    expect(fsPromises.readFile).toHaveBeenCalledTimes(1);
  });

  it('readConfig() throws an error when JSON is invalid', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fsPromises.readFile).mockResolvedValue('invalid-json');
    
    await expect(readConfig()).rejects.toThrow();
  });

  it('writeConfig() writes JSON to file properly', async () => {
    const newConfig: RadzorConfig = {
      $schema: 'https://radzor.io/schema/config',
      componentDir: 'components/radzor',
      registry: 'https://radzor.io',
    };
    
    await writeConfig(newConfig);
    
    expect(fsPromises.writeFile).toHaveBeenCalledTimes(1);
    const writtenData = vi.mocked(fsPromises.writeFile).mock.calls[0][1] as string;
    expect(JSON.parse(writtenData)).toEqual(newConfig);
  });
});
