import type { CSSProperties } from 'react'

/**
 * Shared styling for a native <select> that must line up with the text
 * inputs beside it.
 *
 * WHY: a default `<select>` keeps its platform chrome (`appearance: auto`),
 * which gives it the OS arrow, the OS's own intrinsic height and squarer
 * corners than a styled `<input>`. Next to real inputs the dropdown ends up
 * visibly shorter and off-style -- exactly the defect reported on the
 * waitlist form (2026-10-17), where "Persons" did not match Name/Email/Phone.
 *
 * FIX: `appearance-none` turns the select into a plain styled box so the
 * shared padding/border/radius actually control its height, and this inline
 * brand chevron replaces the OS arrow so it still reads as a dropdown. The
 * <select> element itself is untouched, so it remains a real dropdown
 * (keyboard, native option list, mobile picker).
 *
 * Usage on the <select>: add `appearance-none cursor-pointer` to the class
 * list, spread this style, and keep the same padding/typography as the
 * inputs. `paddingRight` is set here (not via a `pr-*` utility) so it can
 * never lose a specificity race with an `px-*` class on the same element.
 *
 * Same technique as the console's FilterSelect (src/components/console/
 * FilterBar.tsx), which solved this for the admin toolbars; that one stays
 * console-local, this one is the public-site equivalent.
 */
export const SELECT_CHEVRON: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%2333483D' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.875rem center',
  backgroundSize: '12px 12px',
  // Room for the chevron; overrides the right half of any `px-*` class.
  paddingRight: '2.5rem',
}
