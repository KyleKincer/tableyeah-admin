# Documentation vs Implementation Inconsistencies

This document details inconsistencies between the TableYeah documentation (`content/docs/`) and actual implementations in both the web app (`tableyeah`) and mobile app (`tableyeah-admin`).

**Date:** January 6, 2026
**Documentation Last Updated:** January 15, 2025
**Last Reviewed:** January 7, 2026

---

## Summary

| Category | Status |
|----------|--------|
| Broken documentation links | ~~10 pages referenced but don't exist~~ **FIXED** |
| Settings tabs discrepancy | ~~Docs list 12, web has 11~~ **FIXED** - docs now match web |
| Mobile settings parity | ~~Team, Branding, Billing missing~~ **FIXED** - implemented Jan 2026 |
| Features in docs but missing from mobile | 2 major features (Gift Cards, Commerce) |
| Features in web not documented | 2 features |
| Features documented but not in web or mobile | ~~2 features~~ **FIXED** - removed from docs |

---

## 1. Broken Documentation Links

~~The following documentation pages are referenced but **do not exist**:~~

**STATUS: RESOLVED**

### Actions Taken:
- Created `/docs/reservations/waitlist.mdx` - full waitlist documentation
- Removed link to `/docs/reservations/recurring` (feature not implemented)
- Removed broken links from `guests/index.mdx` - replaced with related links
- Removed broken links from `events/index.mdx` - replaced with related links
- Removed broken links from `gift-cards/index.mdx` - replaced with related links

**Decision needed:**
- [x] Create these documentation pages -- NOTE: create these where it makes sense given the current functionality of the app.
- [x] Remove the broken links from existing docs -- **DONE**

---

## 2. Settings Tabs Discrepancy

**STATUS: RESOLVED**

### Actions Taken:
- Removed Products and Storefront from `settings/index.mdx` (they're in Commerce page, not Settings)
- `ProductsSettings.tsx` and `StorefrontSettings.tsx` are used by Commerce page - DO NOT DELETE
- **Implemented Team, Branding, Billing in mobile app (January 2026)**

### Documentation (`settings/index.mdx`) Now Lists 11 Tabs (matches web app):
1. General
2. Team
3. Servers
4. Hours
5. Branding
6. Zones
7. Tables
8. Reservations
9. Guest Tags
10. Notifications
11. Billing

### Mobile App Settings Screens (now 12 screens):
1. General
2. Reservations (seating settings)
3. Operating Hours
4. Tables
5. Servers
6. Table Assignments
7. Notifications
8. Guest Tags
9. Zones (advanced)
10. **Team** (NEW - Jan 2026)
11. **Branding** (NEW - Jan 2026)
12. **Billing** (NEW - Jan 2026)

**Decision needed:**
- [x] Remove Products/Storefront from docs (if not implementing) -- **DONE** (they're in Commerce, not Settings)
- [x] ~~Implement Products/Storefront tabs in web app~~ -- N/A (they're in Commerce page)
- [x] Add missing settings to mobile app (Team, Branding, Billing) -- **DONE** (January 2026)

---

## 3. Features Documented but Missing from Mobile App

### 3.1 Gift Cards

**STATUS: DOCS UPDATED**

**Actions Taken:**
- Added web-only callout to `gift-cards/index.mdx`
- Fixed incorrect reference to "Settings → Gift Cards" (now "Commerce → Products")
- Removed broken links to sub-pages

**Web App:** Fully implemented at `/admin/commerce/` (Gift Cards tab)

**Mobile App:** **NOT IMPLEMENTED**

**Decision needed:**
- [ ] Implement gift cards in mobile app (future)
- [x] Note in docs that gift cards are web-only -- **DONE**

---

### 3.2 Team/Staff Management

**STATUS: IMPLEMENTED IN MOBILE**

**Documentation:** `settings/index.mdx`
- Invite and manage staff members
- Assign roles (Owner, Admin, Manager, Staff)
- View pending invitations

**Web App:** Fully implemented in Settings > Team tab

**Mobile App:** **IMPLEMENTED** (January 2026)
- Staff list with role badges and last sign-in
- Invite staff modal (email, name, role)
- Role change for OWNER/ADMIN users
- Revoke invitations
- Remove staff with confirmation

**Files created:**
- `components/settings/TeamSettings.tsx`
- `components/settings/InviteStaffModal.tsx`
- `app/settings/team.tsx`

---

### 3.3 Branding Settings

**STATUS: IMPLEMENTED IN MOBILE**

**Documentation:** `settings/index.mdx` and `getting-started/quick-setup.mdx`
- Logo upload (512x512+)
- Wordmark (1200x300)
- Cover image (2400x1200)
- Favicon and OG image
- Auto-generated brand colors

**Web App:** Fully implemented in Settings > Branding tab

**Mobile App:** **IMPLEMENTED** (January 2026)
- All 5 branding asset uploads (logo, wordmark, cover, favicon, OG)
- Image picker via expo-image-picker
- Color swatches with manual color picker (reanimated-color-picker)
- Generate colors from any uploaded image
- Remove/replace images

**Files created:**
- `components/settings/BrandingSettings.tsx`
- `app/settings/branding.tsx`
- Backend: `app/api/admin/uploads/restaurant-branding/mobile/route.ts`
- Backend: `app/api/admin/settings/branding/colors/route.ts`

---

### 3.4 Billing/Subscription Management

**STATUS: IMPLEMENTED IN MOBILE**

**Documentation:** `billing/index.mdx`
- Start subscription
- Update payment method
- View invoices
- Cancel subscription
- Stripe Connect setup

**Web App:** Fully implemented in Settings > Billing tab

**Mobile App:** **IMPLEMENTED** (January 2026)
- Subscription status display (Active/Trial/Past Due/etc.)
- Billing period dates
- Payment method display (card brand + last 4)
- Trial countdown
- Start Trial / Manage Subscription buttons (opens in browser)
- Stripe Connect status and onboarding

**Files created:**
- `components/settings/BillingSettings.tsx`
- `app/settings/billing.tsx`

---

### 3.5 Commerce/Orders
**Documentation:** Not documented

**Web App:** Implemented at `/admin/commerce/` and `/admin/orders/[id]`
- Order list view
- Order details with items
- Fulfillment status management
- Refund tracking

**Mobile App:** **NOT IMPLEMENTED**

**Decision needed:**
- [ ] Document commerce/orders feature
- [ ] Implement in mobile app

---

## 4. Features Documented but Not Implemented Anywhere

**STATUS: RESOLVED**

### 4.1 Products Tab in Settings
~~**Documentation:** `settings/index.mdx` lists Products tab~~

**Actions Taken:**
- Removed Products from `settings/index.mdx`
- Products functionality exists in Commerce page (`/admin/commerce?tab=products`)

### 4.2 Storefront Tab in Settings
~~**Documentation:** `settings/index.mdx` lists Storefront tab~~

**Actions Taken:**
- Removed Storefront from `settings/index.mdx`
- Storefront functionality exists in Commerce page (`/admin/commerce?tab=settings`)

---

## 5. Features Implemented but Not Documented

### 5.1 Activity Feed/Log
**Web App:** `/admin/activity/` - Full activity log page
**Mobile App:** Dashboard includes activity feed, dedicated activity screen

**Documentation:** Not mentioned in any docs

**Decision needed:**
- [ ] Document the activity feed feature

---

### 5.2 Special Service Hours
**Web App:** Settings > Hours tab includes "Special Service Hours" for holidays/events

**Documentation:** Only mentions regular operating hours

**Decision needed:**
- [ ] Document special service hours feature

---

### 5.3 Zone Booking Rules & Pacing
**Web App:** Advanced zone configuration with:
- Per-zone party size limits
- Per-zone turn times
- Cross-zone booking settings
- Pacing rules (max covers/parties per slot)

**Documentation:** Only mentions creating zones and marking them bookable

**Decision needed:**
- [ ] Document advanced zone booking rules

---

### 5.4 Floor Plan Canvas

**STATUS: RESOLVED**

**Actions Taken:**
- Created `/docs/reservations/service-view.mdx` with comprehensive documentation
- Covers all view modes (Floor Plan, Timeline, List)
- Documents seating workflows (reservations, walk-ins, waitlist)
- Documents server assignments and paint mode
- Documents Live Mode and mobile-specific features
- Added links from `reservations/index.mdx` and `your-first-reservation.mdx`

**Decision needed:**
- [x] Create dedicated floor plan/service view documentation -- **DONE**

---

## 6. Waitlist Feature Discrepancies

**STATUS: RESOLVED**

**Actions Taken:**
- Created `/docs/reservations/waitlist.mdx` with full documentation
- Documents SMS notifications, mobile app features, best practices
- Added link from `reservations/index.mdx`

**Decision needed:**
- [x] Create waitlist documentation page -- **DONE**
- [x] Document SMS notification capability for waitlist -- **DONE**

---

## 7. Event Types Discrepancy

**STATUS: RESOLVED**

**Actions Taken:**
- Removed "Private events" from `events/index.mdx`
- Documentation now lists only implemented event types: Ticketed, RSVP, Deposit

**Decision needed:**
- [x] Remove "Private events" from docs -- **DONE**
- [ ] Implement private/invite-only events (future consideration)

---

## 8. Reservation Status Flow Discrepancy

**STATUS: RESOLVED**

**Actions Taken:**
- Updated `reservations/index.mdx` with complete status flow diagram
- Added ASCII diagram showing all transitions including CANCELLED and NO_SHOW branches
- Added "Available Actions by Status" table

**Decision needed:**
- [x] Update docs to show full status flow diagram -- **DONE**

---

## 9. Guest Spend History

**STATUS: RESOLVED**

**Actions Taken:**
- Changed "Spend history" to "Visit stats" in `guests/index.mdx`
- Now correctly documents: "Visit stats: Total visits and no-show count"

**Decision needed:**
- [x] Remove spend history from docs -- **DONE** (replaced with accurate info)
- [ ] Implement spend tracking (from events/orders) - future feature

---

## 10. Auto-Confirm Setting

**STATUS: RESOLVED**

**Actions Taken:**
- Updated `your-first-reservation.mdx` callout to accurately describe behavior:
  > Guest self-service bookings start with **Booked** status and require staff confirmation. Check the **Unconfirmed** tab regularly to confirm new bookings.

**Decision needed:**
- [x] Remove auto-confirm mention from docs -- **DONE**
- [ ] Implement auto-confirm setting - future feature consideration

---

## 11. Mobile-Specific Features Not Documented

The mobile app has features that aren't documented anywhere:

1. **Swipeable actions** on reservations and waitlist
2. **Contact action sheet** (long-press to call/email)
3. **Live mode** with real-time refresh
4. **Timeline view** for service
5. **Server paint mode** for bulk table assignments
6. **Walk-in creation** from floor plan
7. **Drag-and-drop seating** from list to floor plan

**Decision needed:**
- [ ] Create mobile app-specific documentation
- [ ] Add mobile features to existing docs

---

## 12. URL/Domain Discrepancies

**Documentation uses:** `your-restaurant.app.tableyeah.com`
**Actual pattern:** `{tenant}.app.tableyeah.com`

This is fine as a placeholder, but could be made clearer.

---

## Recommended Priority Order

### Completed
- [x] Fix broken documentation links (remove or create pages)
- [x] Document waitlist feature
- [x] Remove Products/Storefront from Settings docs
- [x] Add web-only note to gift cards
- [x] Remove "Private events" from docs
- [x] Fix spend history → visit stats
- [x] Fix auto-confirm callout
- [x] Update reservation status flow diagram in docs
- [x] Document floor plan/service view
- [x] **Add missing settings to mobile (Team, Branding, Billing)** - January 2026

### Remaining - Medium Priority
1. Document activity feed feature
2. Document special service hours and zone rules
3. Document Commerce section (Orders, Products, Inventory)
4. Implement Commerce in mobile app (Orders, Gift Cards, Products) - **IN PROGRESS**

### Remaining - Low Priority
5. Document mobile-specific features (swipe actions, live mode, etc.)
6. Create dedicated documentation for advanced zone booking rules

---

## File References

### Documentation Files
- `/home/kck/src/tableyeah/content/docs/getting-started/index.mdx`
- `/home/kck/src/tableyeah/content/docs/getting-started/quick-setup.mdx`
- `/home/kck/src/tableyeah/content/docs/getting-started/your-first-reservation.mdx`
- `/home/kck/src/tableyeah/content/docs/reservations/index.mdx`
- `/home/kck/src/tableyeah/content/docs/reservations/creating-reservations.mdx`
- `/home/kck/src/tableyeah/content/docs/reservations/waitlist.mdx` **(NEW)**
- `/home/kck/src/tableyeah/content/docs/reservations/service-view.mdx` **(NEW)**
- `/home/kck/src/tableyeah/content/docs/events/index.mdx`
- `/home/kck/src/tableyeah/content/docs/guests/index.mdx`
- `/home/kck/src/tableyeah/content/docs/gift-cards/index.mdx`
- `/home/kck/src/tableyeah/content/docs/settings/index.mdx`
- `/home/kck/src/tableyeah/content/docs/billing/index.mdx`

### Key Implementation Files
- Web Settings: `/home/kck/src/tableyeah/components/admin/settings/SettingsPageClient.tsx`
- Web Gift Cards: `/home/kck/src/tableyeah/app/admin/gift-cards/`
- Mobile Settings: `/home/kck/src/tableyeah-admin/app/(tabs)/settings.tsx`
- Mobile Service: `/home/kck/src/tableyeah-admin/app/(tabs)/service.tsx`
