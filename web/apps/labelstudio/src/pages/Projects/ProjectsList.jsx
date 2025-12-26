import chr from "chroma-js";
import { format } from "date-fns";
import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { IconCheck, IconEllipsis, IconMinus, IconSparks } from "@humansignal/icons";
import { Button, Dropdown, Tooltip, Userpic } from "@humansignal/ui";
import { Menu, Pagination } from "../../components";
import { ProjectStateChip } from "@humansignal/app-common";
import { cn } from "../../utils/bem";
import { absoluteURL } from "../../utils/helpers";
import { getEmoji } from "./ProjectsUtils";

const DEFAULT_CARD_COLORS = ["#FFFFFF", "#FDFDFC"];

export const ProjectsList = ({ projects, currentPage, totalItems, loadNextPage, pageSize }) => {
  return (
    <>
      <div className={cn("projects-page").elem("list").toClassName()}>
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      <div className={cn("projects-page").elem("pages").toClassName()}>
        <Pagination
          name="projects-list"
          label="Projects"
          page={currentPage}
          totalItems={totalItems}
          urlParamName="page"
          pageSize={pageSize}
          pageSizeOptions={[10, 30, 50, 100]}
          onPageLoad={(page, pageSize) => loadNextPage(page, pageSize)}
        />
      </div>
    </>
  );
};

export const EmptyProjectsList = ({ openModal }) => {
  return (
    <div className={cn("empty-projects-page").toClassName()}>
      <img
        alt="Heidi looking for projects"
        className={cn("empty-projects-page").elem("heidi").toClassName()}
        src={absoluteURL("/static/images/opossum_looking.png")}
      />
      <h1 className={cn("empty-projects-page").elem("header").toClassName()}>Heidi doesn't see any projects here!</h1>
      <p>Create one and start labeling your data.</p>
      <Button onClick={openModal} className="my-8" aria-label="Create new project">
        Create Project
      </Button>
    </div>
  );
};

const ProjectCard = ({ project }) => {
  const color = useMemo(() => {
    return DEFAULT_CARD_COLORS.includes(project.color) ? null : project.color;
  }, [project.color]);

  const projectColors = useMemo(() => {
    const textColor =
      color && chr(color).luminance() > 0.3
        ? "var(--color-neutral-inverted-content)"
        : "var(--color-neutral-inverted-content)";
    return color
      ? {
          "--header-color": color,
          "--background-color": chr(color).alpha(0.2).css(),
          "--text-color": textColor,
          "--border-color": chr(color).alpha(0.5).css(),
        }
      : {};
  }, [color]);

  const progressPercentage =
    project?.task_number > 0 ? Math.round((project.finished_task_number / project.task_number) * 100) : 0;

  const emoji = getEmoji(project.weekly_annotation_count, project.task_number, project.finished_task_number);
  const weekly = project.weekly_annotation_count ?? 0;

  return (
    <NavLink className={cn("projects-page").elem("link").toClassName()} to={`/projects/${project.id}/data`} data-external>
      <div className={cn("project-card").mod({ colored: !!color }).toClassName()} style={projectColors}>
        <div className={cn("project-card").elem("header").toClassName()}>
          <div className={cn("project-card").elem("title").toClassName()}>
            <div className={cn("project-card").elem("title-text-wrapper").toClassName()}>
              <Tooltip title={project.title ?? "New project"}>
                <div className={cn("project-card").elem("title-text").toClassName()}>{project.title ?? "New project"}</div>
              </Tooltip>
            </div>

            {weekly > 0 && (
              <Tooltip title={`${weekly} annotations created this week`}>
                <div className={cn("project-card").elem("weekly").toClassName()}>+{weekly}wk</div>
              </Tooltip>
            )}

            <div
              className={cn("project-card").elem("menu").toClassName()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Dropdown.Trigger
                content={
                  <Menu contextual>
                    <Menu.Item href={`/projects/${project.id}/settings`}>Settings</Menu.Item>
                    <Menu.Item href={`/projects/${project.id}/data?labeling=1`}>Label</Menu.Item>
                  </Menu>
                }
              >
                <Button size="smaller" look="string" aria-label="Project options">
                  <IconEllipsis />
                </Button>
              </Dropdown.Trigger>
            </div>

            {project.state && (
              <div className={cn("project-card").elem("state-chip").toClassName()}>
                <ProjectStateChip state={project.state} projectId={project.id} interactive={false} />
              </div>
            )}
          </div>

          <div className={cn("project-card").elem("summary").toClassName()}>
            <div className={cn("project-card").elem("annotation").toClassName()}>
              <div className={cn("project-card").elem("total").toClassName()}>
                {project.finished_task_number} / {project.task_number}
              </div>
              <div className={cn("project-card").elem("detail").toClassName()}>
                <div className={cn("project-card").elem("detail-item").mod({ type: "completed" }).toClassName()}>
                  <IconCheck className={cn("project-card").elem("icon").toClassName()} />
                  {project.total_annotations_number}
                </div>
                <div className={cn("project-card").elem("detail-item").mod({ type: "rejected" }).toClassName()}>
                  <IconMinus className={cn("project-card").elem("icon").toClassName()} />
                  {project.skipped_annotations_number}
                </div>
                <div className={cn("project-card").elem("detail-item").mod({ type: "predictions" }).toClassName()}>
                  <IconSparks className={cn("project-card").elem("icon").toClassName()} />
                  {project.total_predictions_number}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={cn("project-card").elem("description").toClassName()}>{project.description}</div>

        <div className={cn("project-card").elem("footer").toClassName()}>
          <div className={cn("project-card").elem("progress-bar").toClassName()}>
            <div
              className={cn("project-card").elem("progress-fill").mod({ complete: progressPercentage === 100 }).toClassName()}
              style={{
                width: `${progressPercentage}%`,
                opacity: 0.4 + (progressPercentage / 100) * 0.6,
              }}
            />
          </div>
          <div className={cn("project-card").elem("progress-text").toClassName()}>{progressPercentage}%</div>
          <div className={cn("project-card").elem("emoji").toClassName()}>{emoji}</div>
        </div>

        <div className={cn("project-card").elem("info").toClassName()}>
          <div className={cn("project-card").elem("created-date").toClassName()}>
            {project.created_at ? format(new Date(project.created_at), "dd MMM yyyy, HH:mm") : ""}
          </div>
          <div className={cn("project-card").elem("created-by").toClassName()}>
            <Userpic src="#" user={project.created_by} showUsernameTooltip />
          </div>
        </div>
      </div>
    </NavLink>
  );
};
