-- supabase/migrations/001_schema.sql

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  generated_code TEXT DEFAULT '',
  shared_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agent memory documents table
CREATE TABLE agent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agent_role TEXT NOT NULL,  -- 'pm' | 'architect' | 'engineer' | 'mcp_server'
  content TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  round INTEGER DEFAULT 1,
  embedding_json TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_projects_user ON projects(user_id, created_at DESC);
CREATE INDEX idx_agent_docs_project ON agent_documents(project_id, agent_role, round);

-- RLS: projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- RLS: agent_documents (via subquery)
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read docs of own projects" ON agent_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_documents.project_id AND projects.user_id = auth.uid())
  );
CREATE POLICY "Users can insert docs to own projects" ON agent_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_documents.project_id AND projects.user_id = auth.uid())
  );
CREATE POLICY "Users can update docs of own projects" ON agent_documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_documents.project_id AND projects.user_id = auth.uid())
  );
CREATE POLICY "Users can delete docs of own projects" ON agent_documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_documents.project_id AND projects.user_id = auth.uid())
  );
