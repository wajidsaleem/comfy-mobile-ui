import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        style: {
          background: 'rgba(30, 41, 59, 0.5)', // dark:bg-slate-800/50
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(51, 65, 85, 0.4)', // dark:border-slate-700/40
          borderRadius: '16px', // rounded-2xl
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3)', // shadow-xl shadow-slate-900/30
          color: 'rgb(241, 245, 249)', // text-slate-100
          fontSize: '14px', 
          padding: '10px 16px',
          width: 'calc(100vw - 32px)',
          maxWidth: 'none',
        },
        classNames: {
          toast: 'group toast group-[.toaster]:bg-transparent group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
