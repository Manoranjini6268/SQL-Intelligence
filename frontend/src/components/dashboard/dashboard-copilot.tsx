'use client';

import { CopilotKit, useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { CopilotPopup } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import type { DashboardWidgetResult, TableInfo, UIHint } from '@/lib/types';

interface DashboardCopilotProps {
  database?: string;
  connectorType?: string;
  tables: TableInfo[];
  widgetResults: DashboardWidgetResult[];
  addWidget: (prompt: string, uiHint: UIHint, size: 'sm' | 'md' | 'lg') => Promise<void>;
  regenerateDashboard: () => Promise<void>;
  openOnMount?: boolean;
}

function DashboardCopilotInner({
  database,
  connectorType,
  tables,
  widgetResults,
  addWidget,
  regenerateDashboard,
  openOnMount = false,
}: DashboardCopilotProps) {
  useCopilotReadable({
    description: 'Database tables and schema available for querying',
    value: JSON.stringify({
      database,
      connectorType,
      tables: tables.map((t) => ({ name: t.name, columns: t.columnCount })),
    }),
  });

  useCopilotReadable({
    description: 'Current dashboard widgets displayed',
    value: JSON.stringify(widgetResults.map((w) => ({ title: w.title, type: w.ui_hint }))),
  });

  useCopilotAction({
    name: 'addDashboardWidget',
    description: 'Add a new visualization widget to the dashboard.',
    parameters: [
      { name: 'prompt', type: 'string', description: 'Description of what data to show', required: true },
      {
        name: 'widgetType',
        type: 'string',
        description:
          'One of: metric_card, bar_chart, line_chart, pie_chart, area_chart, data_table, list, stat_grid, donut_chart, stacked_bar, horizontal_bar, scatter_plot, radar_chart, gauge, number_trend, comparison_card, funnel_chart, timeline, treemap',
        required: true,
      },
      { name: 'size', type: 'string', description: 'Widget size: sm, md, or lg', required: false },
    ],
    handler: async ({ prompt, widgetType, size }) => {
      const uiHint: UIHint = widgetType as UIHint;
      const widgetSize =
        (['sm', 'md', 'lg'] as const).includes(size as 'sm' | 'md' | 'lg')
          ? (size as 'sm' | 'md' | 'lg')
          : 'md';
      await addWidget(prompt, uiHint, widgetSize);
      return `Widget "${prompt}" added to dashboard.`;
    },
  });

  useCopilotAction({
    name: 'regenerateDashboard',
    description: 'Regenerate all dashboard widgets with fresh AI-generated insights.',
    parameters: [],
    handler: async () => {
      await regenerateDashboard();
      return 'Dashboard regenerated.';
    },
  });

  return (
    <CopilotPopup
      instructions={`You are DataIntel AI assistant. You help users build dashboard visualizations.
The user is connected to a ${connectorType || 'database'} database called "${database || 'unknown'}".
Available tables/indices: ${tables.map((t) => t.name).join(', ')}.
When the user asks to see data, use the addDashboardWidget action with a clear prompt describing what to query.
Choose the best widget type for the data.
Keep responses friendly and concise.`}
      labels={{
        title: 'DataIntel AI',
        placeholder: 'Ask me to add charts, metrics, or explore your data…',
      }}
      defaultOpen={openOnMount}
      clickOutsideToClose
    />
  );
}

export function DashboardCopilot(props: DashboardCopilotProps) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole={false}>
      <DashboardCopilotInner {...props} />
    </CopilotKit>
  );
}
