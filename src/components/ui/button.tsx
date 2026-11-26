import { cva } from 'class-variance-authority';

/** Minimal stand-in for shadcn's buttonVariants, mapped onto Prila's own .btn system. */
export const buttonVariants = cva('btn', {
  variants: {
    variant: {
      default: 'btn-primary',
      secondary: 'btn-secondary',
      outline: 'btn-secondary',
      destructive: 'btn-danger',
      ghost: 'btn-soft',
      link: 'btn-link',
    },
    size: { default: '', sm: 'btn-sm', lg: '', icon: 'btn-sm' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
