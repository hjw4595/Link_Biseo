'use client';

import { TopBar } from '@/components/common/top-bar';

import { LogoutAction } from '@/features/auth/logout-action';
import { SettingsStatistics } from '@/features/settings/components/settings-statistics';
import { Account } from '@/features/auth/account';
import { CleanupPreferences } from '@/features/links/components/cleanup-preferences';

export default function SettingsPage() {
  return (
    <>
      <TopBar title="설정" />
      <div className="screen-content">
        <h1 className="sr-only">설정</h1>
        <Account />
        <SettingsStatistics />
        <CleanupPreferences />
        <LogoutAction />
      </div>
    </>
  );
}
