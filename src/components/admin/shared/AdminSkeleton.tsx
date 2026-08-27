import React from"react";

type AdminSkeletonProps = {
 className?: string;
 label?: string;
};

export const AdminSkeleton: React.FC<AdminSkeletonProps> = ({
 className ="",
 label ="Carregando conteúdo",
}) => (
 <div
 aria-label={label}
 aria-busy="true"
 className={`admin-skeleton rounded-[var(--admin-radius-md)] bg-[var(--admin-bg)] ${className}`}
 />
);

type AdminListSkeletonProps = {
 rows?: number;
 className?: string;
};

export const AdminListSkeleton: React.FC<AdminListSkeletonProps> = ({
 rows = 4,
 className ="",
}) => (
 <div
 className={`space-y-3 ${className}`}
 aria-label="Carregando lista"
 aria-busy="true"
 >
 {Array.from({ length: rows }, (_, index) => (
 <div
 key={index}
 className="flex items-center gap-3 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-3"
 >
 <AdminSkeleton className="h-10 w-10 shrink-0 rounded-[var(--admin-radius-full)]"/>
 <div className="min-w-0 flex-1 space-y-2">
 <AdminSkeleton className="h-3 w-2/5"/>
 <AdminSkeleton className="h-2.5 w-3/4"/>
 </div>
 <AdminSkeleton className="h-8 w-16 shrink-0 rounded-[var(--admin-radius-sm)]"/>
 </div>
 ))}
 </div>
);

export const AdminPageSkeleton: React.FC = () => (
 <div className="space-y-4"aria-label="Carregando painel"aria-busy="true">
 <div className="flex items-center justify-between gap-3">
 <div className="space-y-2">
 <AdminSkeleton className="h-4 w-32"/>
 <AdminSkeleton className="h-2.5 w-52 max-w-[60vw]"/>
 </div>
 <AdminSkeleton className="h-10 w-24 rounded-[var(--admin-radius-lg)]"/>
 </div>
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
 {Array.from({ length: 4 }, (_, index) => (
 <AdminSkeleton key={index} className="h-20 rounded-[var(--admin-radius-lg)]"/>
 ))}
 </div>
 <AdminListSkeleton rows={4} />
 </div>
);
