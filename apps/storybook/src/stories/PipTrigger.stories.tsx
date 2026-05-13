import type { Meta, StoryObj } from '@storybook/react';
import { PipTrigger, PipWrapper } from '@pip-it-up/react';
import { expect, within } from '@storybook/test';

const meta = {
  title: 'React/PipTrigger',
  component: PipTrigger,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    asChild: { control: 'boolean' },
    pipId: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div>
        <PipWrapper>
          <div style={{ display: 'none' }} data-testid="pip-content">
            Content
          </div>
          <Story />
        </PipWrapper>
      </div>
    ),
  ],
} satisfies Meta<typeof PipTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Toggle PiP window',
  },
};

export const AsChild: Story = {
  args: {
    asChild: true,
    children: (
      <button style={{ backgroundColor: 'blue', color: 'white', padding: 10, borderRadius: 5 }}>
        Custom Button Element
      </button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement) as any;
    const button = canvas.getByRole('button', { name: /Custom Button Element/i });
    await expect(button).toBeInTheDocument();
    await expect(button).toHaveStyle({ backgroundColor: 'rgb(0, 0, 255)' });
  },
};
