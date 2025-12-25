import { FC, useCallback, useState, useEffect } from "react";
import { useAPI } from "apps/labelstudio/src/providers/ApiProvider";
import { Block, Elem } from "apps/labelstudio/src/utils/bem";
import { IconPersonInCircle } from "../../assets/icons";
import "./OrgSwitcher.scss";

interface Organization {
  id: number;
  title: string;
  active: boolean;
}

interface OrganizationsResponse {
  organizations: Organization[];
}

export const OrgSwitcher: FC = () => {
  const { callApi } = useAPI();
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await callApi<OrganizationsResponse>("userOrganizations");
      
      if (response?.organizations) {
        setOrganizations(response.organizations);
      }
    } catch (error: unknown) {
    }
  }, [callApi]);

  const switchOrganization = useCallback(async (orgId: number) => {
    try {
      await callApi("setActiveOrganization", {
        body: {
          organization_id: orgId
        }
      });
      
      await fetchOrganizations();
      window.location.reload();
    } catch (error: unknown) {
    }
  }, [callApi, fetchOrganizations]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Only render if user has multiple organizations
  if (organizations.length <= 1) return null;

  return (
    <Block name="org-switcher">
      <Elem name="header">
        <IconPersonInCircle />
        Organization
      </Elem>
      <ul className="lsf-main-menu">
        {organizations.map(org => {
          const isActive = org.active;
          return (
            <li
              key={org.id}
              className={`lsf-main-menu__item${isActive ? ' lsf-main-menu__item_active' : ''}`}
              onClick={() => !isActive && switchOrganization(org.id)}
            >
              {org.title}
              {isActive && (
                <span className="lsf-main-menu__item-beta">
                  Current
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Block>
  );
}; 
