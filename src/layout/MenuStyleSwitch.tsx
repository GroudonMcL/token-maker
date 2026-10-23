import { SegmentedButtons } from '../components';
import { setMenuStyle, useMenuStyle, type MenuStyle } from '../state/menuStyle';

const OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
] as const satisfies readonly { value: MenuStyle; label: string }[];

/** Simple / Advanced / Expert: how many settings the panel sections show. Sits above Import. */
export function MenuStyleSwitch() {
  const style = useMenuStyle();
  return (
    <div className="menu-style">
      <SegmentedButtons label="Menu style" helpId="panel.menuStyle" options={OPTIONS} value={style} onChange={setMenuStyle} />
    </div>
  );
}
