const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');

if (!code.includes('usePullToRefresh')) {
    code = code.replace("import React, { useState } from 'react';", "import React, { useState, useRef } from 'react';\nimport { usePullToRefresh } from '../../hooks/usePullToRefresh';\nimport { PullToRefreshIndicator } from '../shared/PullToRefreshIndicator';");
    
    code = code.replace("const renderContent = () => {", `
  const mainRef = useRef<HTMLDivElement>(null);
  const { pullDistance, isRefreshing, handlers: pullToRefreshHandlers } = usePullToRefresh(
    mainRef,
    {
      onRefresh: async () => {
        window.dispatchEvent(new CustomEvent('adminRefresh'));
        await new Promise(resolve => setTimeout(resolve, 800)); // wait a bit for data to load
      }
    }
  );

  const renderContent = () => {`);

    code = code.replace('<main className="flex-1 lg:ml-64 pt-[56px] lg:pt-0 h-[100dvh] overflow-y-auto no-scrollbar relative w-full">',
    '<main ref={mainRef} className="flex-1 lg:ml-64 pt-[56px] lg:pt-0 h-[100dvh] overflow-y-auto no-scrollbar relative w-full" tabIndex={-1} onTouchStart={pullToRefreshHandlers.onTouchStart} onTouchMove={pullToRefreshHandlers.onTouchMove} onTouchEnd={pullToRefreshHandlers.onTouchEnd}>\n        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />');

    fs.writeFileSync('src/components/admin/AdminLayout.tsx', code);
    console.log("Patched AdminLayout");
} else {
    console.log("Already patched");
}
