import React, { forwardRef, ReactNode } from 'react';

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

export const Slot = forwardRef<HTMLElement, SlotProps>((props, ref) => {
  const { children, ...slotProps } = props;

  if (React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...slotProps,
      ...children.props,
      style: {
        ...slotProps.style,
        ...(children.props as Record<string, unknown>).style as React.CSSProperties | undefined,
      },
      className: [slotProps.className, (children.props as Record<string, unknown>).className].filter(Boolean).join(' '),
      ref: (node: HTMLElement) => {
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;

        // React 19: ref is a regular prop. React ≤18: ref is on the element directly.
        // Read props.ref first so React 19 never reaches the deprecated element.ref access.
        const childRef = 
          (children.props as { ref?: React.Ref<HTMLElement> }).ref ||
          (children as { ref?: React.Ref<HTMLElement> }).ref;

        if (typeof childRef === 'function') childRef(node);
        else if (childRef) (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    } as React.HTMLAttributes<HTMLElement>);
  }

  if (React.Children.count(children) > 1) {
    throw new Error('PipTrigger asChild expects a single React element child');
  }

  return null;
});

Slot.displayName = 'Slot';
