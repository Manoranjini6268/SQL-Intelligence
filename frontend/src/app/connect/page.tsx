'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Database,
  Server,
  Key,
  User,
  Hash,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { testConnection, connect } from '@/lib/api';
import { saveParams, saveConnectionHistory, loadConnectionHistory } from '@/lib/storage';
import type { ConnectionHistoryEntry } from '@/lib/storage';
import { useSession } from '@/hooks/use-session';
import type { ConnectorType } from '@/lib/types';

const CONNECTOR_OPTIONS: { value: ConnectorType; label: string; icon: string }[] = [
  { value: 'mysql', label: 'MySQL', icon: '🐬' },
  { value: 'postgres', label: 'PostgreSQL', icon: '🐘' },
  { value: 'mongodb', label: 'MongoDB', icon: '🍃' },
  { value: 'elasticsearch', label: 'Elasticsearch', icon: '🔍' },
];

const DEFAULT_PORTS: Record<ConnectorType, number> = {
  mysql: 3306,
  postgres: 5432,
  mongodb: 27017,
  elasticsearch: 9200,
};

const CONNECTOR_ICONS: Record<ConnectorType, string> = {
  mysql: '🐬',
  postgres: '🐘',
  mongodb: '🍃',
  elasticsearch: '🔍',
};

export default function ConnectPage() {
  const router = useRouter();
  const { connect: setConnected } = useSession();

  const [connectorType, setConnectorType] = useState<ConnectorType>('mysql');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(3306);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');

  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentConnections, setRecentConnections] = useState<ConnectionHistoryEntry[]>([]);

  useEffect(() => {
    setRecentConnections(loadConnectionHistory());
  }, []);

  const params = { host, port, username, password, database, connectorType };

  const handleConnectorChange = (value: ConnectorType) => {
    setConnectorType(value);
    setPort(DEFAULT_PORTS[value]);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await testConnection(params);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await connect(params);
      saveParams(params); // persist for session restore on refresh
      saveConnectionHistory(params); // save to recent connections
      setConnected(result);
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const isFormValid = host && port && username && password && database;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
          >
            <Zap className="h-8 w-8 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">Data Intelligence</h1>
          <p className="mt-2 text-muted-foreground">
            Connect to your database or cluster to start querying with natural language
          </p>
        </div>

        {/* Connection Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {connectorType === 'elasticsearch' ? 'Elasticsearch Connection' : 'Database Connection'}
            </CardTitle>
            <CardDescription>
              All connections are read-only. Passwords are never stored.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connector Type */}
            <div className="space-y-2">
              <Label>Database Type</Label>
              <Select value={connectorType} onValueChange={(v) => handleConnectorChange(v as ConnectorType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONNECTOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Host & Port */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="host">
                  <Server className="mr-1 inline h-3.5 w-3.5" />
                  Host
                </Label>
                <Input
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">
                  <Hash className="mr-1 inline h-3.5 w-3.5" />
                  Port
                </Label>
                <Input
                  id="port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">
                <User className="mr-1 inline h-3.5 w-3.5" />
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">
                <Key className="mr-1 inline h-3.5 w-3.5" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            {/* Database / Index Pattern */}
            <div className="space-y-2">
              <Label htmlFor="database">
                <Database className="mr-1 inline h-3.5 w-3.5" />
                {connectorType === 'elasticsearch' ? 'Index Pattern' : 'Database'}
              </Label>
              <Input
                id="database"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder={
                  connectorType === 'elasticsearch'
                    ? 'e.g. logs-* or my-index'
                    : 'Enter database name'
                }
              />
              {connectorType === 'elasticsearch' && (
                <p className="text-xs text-muted-foreground">
                  Use * to discover all indices, or specify a pattern like logs-*
                </p>
              )}
            </div>

            {/* Status Messages */}
            {testResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                  testResult.success
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                {testResult.message}
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={!isFormValid || isTesting}
                className="flex-1"
              >
                {isTesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Test Connection
              </Button>
              <Button
                onClick={handleConnect}
                disabled={!isFormValid || isConnecting}
                className="flex-1"
              >
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Connect
              </Button>
            </div>

            {/* Security Notice */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <Badge variant="outline" className="text-xs">
                Read-Only
              </Badge>
              <Badge variant="outline" className="text-xs">
                Password Not Stored
              </Badge>
              <Badge variant="outline" className="text-xs">
                MCP Isolated
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Recent Connections */}
        {recentConnections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="mt-4"
          >
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Recent connections
            </p>
            <div className="space-y-2">
              {recentConnections.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    setConnectorType(entry.connectorType as ConnectorType);
                    setHost(entry.host);
                    setPort(entry.port);
                    setUsername(entry.username);
                    setDatabase(entry.database);
                    setPassword('');
                    setTestResult(null);
                    setError(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent hover:border-accent"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-base">
                    {CONNECTOR_ICONS[entry.connectorType as ConnectorType] ?? '💾'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{entry.database}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.username}@{entry.host}:{entry.port}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
