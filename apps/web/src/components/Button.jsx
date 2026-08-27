const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold no-underline ' +
  'transition-[transform,filter] duration-150 ease-out-back active:scale-[0.975] ' +
  'disabled:opacity-40 disabled:pointer-events-none cursor-pointer';

const VARIANTS = {
  primary: 'bg-accent text-accent-ink border-0',
  ghost: 'bg-transparent text-paper border border-stroke',
};

const SIZES = {
  // The full-width tap target is the default: on the AR screen it is the only
  // control, and it has to be hittable one-handed.
  md: 'w-full min-h-[52px] px-[22px] text-base',
  sm: 'w-auto min-h-[44px] px-[22px] text-[15px]',
};

export default function Button({ variant = 'primary', size = 'md', className = '', as, ...props }) {
  const Tag = as ?? 'button';
  const type = Tag === 'button' ? (props.type ?? 'button') : undefined;
  return (
    <Tag
      {...props}
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}
