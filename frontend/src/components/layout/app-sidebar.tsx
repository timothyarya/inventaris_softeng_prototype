"use client";

import { ChevronRight, Package } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AuthUser } from "@/lib/auth";
import { findActiveHref, getMenu, type MenuItem } from "@/lib/permissions";

export function AppSidebar({ user }: { user: AuthUser }) {
  const menu = getMenu(user.role);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setOpenMobile } = useSidebar();
  const activeHref = findActiveHref(menu, pathname, searchParams);
  const closeDrawer = () => setOpenMobile(false);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Package className="size-5" />
          <span className="text-sm font-semibold">Inventaris Multi Cabang</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menu.map((item) =>
                item.children ? (
                  <NavGroup
                    key={item.label}
                    item={item}
                    activeHref={activeHref}
                    onNavigate={closeDrawer}
                  />
                ) : (
                  <NavLink
                    key={item.label}
                    item={item}
                    active={item.href === activeHref}
                    onNavigate={closeDrawer}
                  />
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: MenuItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} render={<Link href={item.href!} onClick={onNavigate} />}>
        <Icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroup({
  item,
  activeHref,
  onNavigate,
}: {
  item: MenuItem;
  activeHref: string | null;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const hasActiveChild = item.children!.some((c) => c.href === activeHref);

  return (
    <Collapsible defaultOpen={hasActiveChild} render={<SidebarMenuItem />}>
      <CollapsibleTrigger
        render={<SidebarMenuButton />}
        className="data-panel-open:[&>svg:last-child]:rotate-90"
      >
        <Icon />
        <span>{item.label}</span>
        <ChevronRight className="ml-auto transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {item.children!.map((child) => (
            <SidebarMenuSubItem key={child.href}>
              <SidebarMenuSubButton
                isActive={child.href === activeHref}
                render={<Link href={child.href} onClick={onNavigate} />}
              >
                <span>{child.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}
