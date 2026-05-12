import React, { forwardRef, ReactNode } from 'react';

// A minimal Radix-style Slot helper for asChild pattern.
// Clones the single child, merges props and composes refs.
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
        ...(children.props as any).style,
      },
      className: [slotProps.className, (children.props as any).className].filter(Boolean).join(' '),
      ref: (node: HTMLElement) => {
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as any).current = node;
        
        const childRef = (children as any).ref;
        if (typeof childRef === 'function') childRef(node);
        else if (childRef) childRef.current = node;
      }
    } as any);
  }

  if (React.Children.count(children) > 1) {
    React.Children.only(null); // Force error
  }

  return null;
});

Slot.displayName = 'Slot';
