import { TopBar } from '@/components/common/top-bar';

import { SettingsStatistics } from '@/screens/settings/statistics/settings-statistics';
import { Account } from '@/screens/settings/account/account';
import { CleanupPreferences } from '@/screens/settings/preferences/cleanup-preferences';
import { SettingsFaq } from '@/screens/settings/faq/settings-faq';

export function SettingsScreen() {
  return (
    <>
      <TopBar title="설정" />
      <div className="screen-content">
        <h1 className="sr-only">설정</h1>
        <Account />
        <SettingsStatistics />
        <CleanupPreferences />
        <SettingsFaq />
      </div>
    </>
  );
}
