import chr from "chroma-js";
import { format } from "date-fns";
import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { LsBulb, LsCheck, LsEllipsis, LsMinus } from "../../assets/icons";
import { Button, Dropdown, Menu, Pagination, Userpic } from "../../components";
import { Block, Elem } from "../../utils/bem";
import { absoluteURL } from "../../utils/helpers";
import { getEmoji } from './ProjectsUtils';

const DEFAULT_CARD_COLORS = ["#FFFFFF", "#FDFDFC"];

export const ProjectsList = ({ projects, currentPage, totalItems, loadNextPage, pageSize }) => {
  // Sort projects by completion percentage
  const sortedProjects = [...projects].sort((a, b) => {
    const completionA = a.task_number > 0 ? (a.finished_task_number / a.task_number) : 0;
    const completionB = b.task_number > 0 ? (b.finished_task_number / b.task_number) : 0;
    return completionA - completionB; // Sort ascending (least complete first)
  });

  return (
    <>
      <Elem name="list">
        {sortedProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </Elem>
      <Elem name="pages">
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
      </Elem>
    </>
  );
};

export const EmptyProjectsList = ({ openModal }) => {
  return (
    <Block name="empty-projects-page">
      <Elem name="heidi" tag="img" src={absoluteURL("/static/images/opossum_looking.png")} />
      <Elem name="header" tag="h1">
        Heidi doesn’t see any projects here!
      </Elem>
      <p>Create one and start labeling your data.</p>
      <Elem name="action" tag={Button} onClick={openModal} look="primary">
        Create Project
      </Elem>
    </Block>
  );
};

const ProjectCard = ({ project }) => {
  const color = useMemo(() => {
    return DEFAULT_CARD_COLORS.includes(project.color) ? null : project.color;
  }, [project]);

  const projectColors = useMemo(() => {
    return color
      ? {
          "--header-color": color,
          "--background-color": chr(color).alpha(0.2).css(),
        }
      : {};
  }, [color]);

  // Calculate progress percentage from real data
  const progressPercentage = project.task_number > 0 
    ? Math.round((project.finished_task_number / project.task_number) * 100)
    : 0;

  const emoji = getEmoji(
    project.weekly_annotation_count,
    project.task_number,
    project.finished_task_number
  );

  return (
    <Elem tag={NavLink} name="link" to={`/projects/${project.id}/data`} data-external>
      <Block name="project-card" mod={{ colored: !!color }} style={projectColors}>
        <Elem name="header">
          <Elem name="title">
            <Elem name="title-text">
              {project.title ?? "New project"}
            </Elem>

            <Elem
              name="menu"
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
                <Button size="small" type="text" icon={<LsEllipsis />} />
              </Dropdown.Trigger>
            </Elem>
          </Elem>

          <Elem name="summary">
            <Elem name="annotation">
              <Elem name="total">
                {project.finished_task_number} / {project.task_number}
              </Elem>
              <Elem name="detail">
                <Elem name="detail-item" mod={{ type: "completed" }}>
                  <Elem tag={LsCheck} name="icon" />
                  {project.total_annotations_number}
                </Elem>
                <Elem name="detail-item" mod={{ type: "rejected" }}>
                  <Elem tag={LsMinus} name="icon" />
                  {project.skipped_annotations_number}
                </Elem>
                <Elem name="detail-item" mod={{ type: "predictions" }}>
                  <Elem tag={LsBulb} name="icon" />
                  {project.total_predictions_number}
                </Elem>
              </Elem>
            </Elem>
          </Elem>
        </Elem>
        <Elem name="footer">
          <Elem name="progress-bar">
            <Elem 
              name="progress-fill" 
              mod={{ complete: progressPercentage === 100 }}
              style={{ 
                width: `${progressPercentage}%`,
                opacity: 0.4 + (progressPercentage / 100) * 0.6,
              }}
            />
          </Elem>
          <Elem name="emoji">{emoji}</Elem>
        </Elem>
        <Elem name="description">{project.description}</Elem>
      </Block>
    </Elem>
  );
};
