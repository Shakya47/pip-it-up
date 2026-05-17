import type { Meta, StoryObj } from '@storybook/react-vite';
import { PipWrapper, PipTrigger } from '@pip-it-up/react';
import { expect, within } from '@storybook/test';

const meta = {
  title: 'React/PipWrapper',
  component: PipWrapper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    mode: { control: 'select', options: ['move', 'portal'] },
    fallback: { control: 'select', options: ['new-tab', 'none'] },
    fallbackUrl: { control: 'text' },
    copyStyles: { control: 'select', options: ['once', 'sync'] },
    open: { control: 'boolean' },
    defaultOpen: { control: 'boolean' },
    fixedSize: { control: 'boolean' },
    width: { control: 'number' },
    height: { control: 'number' },
    forwardKeyboardEvents: { control: 'boolean' },
  },
} satisfies Meta<typeof PipWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    mode: 'move',
    children: (
      <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
        <h3>PiP Content</h3>
        <p>This content will move into the PiP window.</p>
        <PipTrigger>
          <button style={{ padding: '8px 16px', marginTop: 10 }}>Toggle PiP</button>
        </PipTrigger>
      </div>
    ),
  },
  play: async ({ canvasElement, step }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvas = within(canvasElement) as any;
    const button = canvas.getByRole('button', { name: /Toggle PiP/i });
    
    await step('Initial render shows button', async () => {
      await expect(button).toBeInTheDocument();
    });
  },
};

export const Controlled: Story = {
  args: {
    mode: 'move',
    open: false,
    children: (
      <div style={{ padding: 20, border: '1px solid #ccc' }}>
        <p>This PiP is controlled via the open prop.</p>
      </div>
    ),
  },
};
