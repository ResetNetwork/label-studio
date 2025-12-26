import React, { useMemo, useState } from "react";
import { useParams as useRouterParams } from "react-router";
import { Redirect } from "react-router-dom";
import { Button, Dropdown, Space, Typography } from "@humansignal/ui";
import { Oneof } from "../../components/Oneof/Oneof";
import { Spinner } from "../../components/Spinner/Spinner";
import { ApiContext } from "../../providers/ApiProvider";
import { useContextProps } from "../../providers/RoutesProvider";
import { cn } from "../../utils/bem";
import { CreateProject } from "../CreateProject/CreateProject";
import { DataManagerPage } from "../DataManager/DataManager";
import { SettingsPage } from "../Settings";
import { EmptyProjectsList, ProjectsList } from "./ProjectsList";
import { useAbortController, useUpdatePageTitle } from "@humansignal/core";
import "./Projects.scss";
import { OrgSwitcher } from "../../components/OrgSwitcher/OrgSwitcher";
import { UserStatsCard } from "../../components/UserStatsCard/UserStatsCard";
import { Menu } from "../../components";

const getCurrentPage = () => {
  const pageNumberFromURL = new URLSearchParams(location.search).get("page");

  return pageNumberFromURL ? Number.parseInt(pageNumberFromURL) : 1;
};

const SORT_OPTIONS = [
  { key: "completion_asc", label: "Least complete" },
  { key: "completion_desc", label: "Most complete" },
  { key: "weekly_desc", label: "Most active (week)" },
  { key: "created_desc", label: "Recently created" },
  { key: "title_asc", label: "Title (A→Z)" },
];

export const ProjectsPage = () => {
  const api = React.useContext(ApiContext);
  const abortController = useAbortController();
  const [projectsList, setProjectsList] = React.useState([]);
  const [networkState, setNetworkState] = React.useState(null);
  const [currentPage, setCurrentPage] = useState(getCurrentPage());
  const [totalItems, setTotalItems] = useState(1);
  const setContextProps = useContextProps();

  useUpdatePageTitle("Projects");
  const defaultPageSize = Number.parseInt(localStorage.getItem("pages:projects-list") ?? 30);

  const [modal, setModal] = React.useState(false);
  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [sortKey, setSortKey] = useState(SORT_OPTIONS[0].key);

  const openModal = () => setModal(true);

  const closeModal = () => setModal(false);

  const fetchProjects = async (page = currentPage, pageSize = defaultPageSize) => {
    setNetworkState("loading");
    abortController.renew(); // Cancel any in flight requests

    const requestParams = { page, page_size: pageSize };

    requestParams.include = [
      "id",
      "title",
      "created_by",
      "created_at",
      "color",
      "is_published",
      "assignment_settings",
      "state",
      "pinned_at",
    ].join(",");

    const data = await api.callApi("projects", {
      params: requestParams,
      signal: abortController.controller.current.signal,
      errorFilter: (e) => e.error.includes("aborted"),
    });

    setTotalItems(data?.count ?? 1);
    setProjectsList(data.results ?? []);
    setNetworkState("loaded");

    if (data?.results?.length) {
      const additionalData = await api.callApi("projects", {
        params: {
          ids: data?.results?.map(({ id }) => id).join(","),
          include: [
            "id",
            "description",
            "num_tasks_with_annotations",
            "task_number",
            "skipped_annotations_number",
            "total_annotations_number",
            "total_predictions_number",
            "ground_truth_number",
            "finished_task_number",
            "weekly_annotation_count",
            "pinned_at",
          ].join(","),
          page_size: pageSize,
        },
        signal: abortController.controller.current.signal,
        errorFilter: (e) => e.error.includes("aborted"),
      });

      if (additionalData?.results?.length) {
        setProjectsList((prev) =>
          additionalData.results.map((project) => {
            const prevProject = prev.find(({ id }) => id === project.id);

            return {
              ...prevProject,
              ...project,
            };
          }),
        );
      }
    }
  };

  const loadNextPage = async (page, pageSize) => {
    setCurrentPage(page);
    await fetchProjects(page, pageSize);
  };

  React.useEffect(() => {
    fetchProjects();
  }, []);

  React.useEffect(() => {
    // there is a nice page with Create button when list is empty
    // so don't show the context button in that case
    setContextProps({ openModal, showButton: projectsList.length > 0 });
  }, [projectsList.length]);

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();

    let results = projectsList;
    if (pinnedOnly) {
      results = results.filter((p) => Boolean(p.pinned_at));
    }

    if (q) {
      results = results.filter((p) => {
        const title = (p.title ?? "").toLowerCase();
        const description = (p.description ?? "").toLowerCase();
        return title.includes(q) || description.includes(q);
      });
    }

    const sortFn = (a, b) => {
      const taskA = a.task_number ?? 0;
      const taskB = b.task_number ?? 0;
      const doneA = a.finished_task_number ?? 0;
      const doneB = b.finished_task_number ?? 0;

      const completionA = taskA > 0 ? doneA / taskA : 0;
      const completionB = taskB > 0 ? doneB / taskB : 0;

      switch (sortKey) {
        case "completion_desc":
          return completionB - completionA;
        case "weekly_desc":
          return (b.weekly_annotation_count ?? 0) - (a.weekly_annotation_count ?? 0);
        case "created_desc":
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        case "title_asc":
          return (a.title ?? "").localeCompare(b.title ?? "");
        case "completion_asc":
        default:
          return completionA - completionB;
      }
    };

    return [...results].sort(sortFn);
  }, [projectsList, pinnedOnly, query, sortKey]);

  const kpis = useMemo(() => {
    const taskTotal = visibleProjects.reduce((sum, p) => sum + (p.task_number ?? 0), 0);
    const taskDone = visibleProjects.reduce((sum, p) => sum + (p.finished_task_number ?? 0), 0);
    const weekly = visibleProjects.reduce((sum, p) => sum + (p.weekly_annotation_count ?? 0), 0);
    const completion = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

    return [
      { label: "Projects", value: `${visibleProjects.length}/${totalItems}` },
      { label: "Tasks (page)", value: taskTotal.toLocaleString() },
      { label: "Labeled (page)", value: taskDone.toLocaleString() },
      { label: "This week (page)", value: weekly.toLocaleString() },
      { label: "Completion (page)", value: `${completion}%` },
    ];
  }, [totalItems, visibleProjects]);

  return (
    <div className={cn("projects-page").toClassName()}>
      <Oneof value={networkState}>
        <div className={cn("projects-page").elem("loading").toClassName()} case="loading">
          <Spinner size={64} />
        </div>
        <div className={cn("projects-page").elem("content").toClassName()} case="loaded">
          <div className={cn("projects-page").elem("header").toClassName()}>
            <div className={cn("projects-page").elem("org").toClassName()}>
              <OrgSwitcher />
            </div>

            <div className={cn("projects-page").elem("toolbar").toClassName()}>
              <div className={cn("projects-page").elem("search").toClassName()}>
                <label className={cn("projects-page").elem("search-label").toClassName()} htmlFor="projects-search">
                  Search
                </label>
                <input
                  id="projects-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={cn("projects-page").elem("search-input").toClassName()}
                  placeholder="Project title or description…"
                />
              </div>

              <Space>
                <Button
                  look="outlined"
                  size="small"
                  onClick={() => setPinnedOnly((prev) => !prev)}
                  aria-pressed={pinnedOnly}
                  aria-label="Toggle pinned projects only"
                >
                  {pinnedOnly ? "Pinned only" : "All projects"}
                </Button>

                <Dropdown.Trigger
                  content={
                    <Menu contextual>
                      {SORT_OPTIONS.map((opt) => (
                        <Menu.Item key={opt.key} onClick={() => setSortKey(opt.key)} active={opt.key === sortKey}>
                          {opt.label}
                        </Menu.Item>
                      ))}
                    </Menu>
                  }
                >
                  <Button look="outlined" size="small" aria-label="Sort projects">
                    Sort: {SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Least complete"}
                  </Button>
                </Dropdown.Trigger>
              </Space>
            </div>

            <div className={cn("projects-page").elem("stats").toClassName()}>
              <UserStatsCard />

              <div className={cn("projects-page").elem("kpis").toClassName()}>
                {kpis.map((kpi) => (
                  <div key={kpi.label} className={cn("projects-page").elem("kpi").toClassName()}>
                    <Typography size="small" className={cn("projects-page").elem("kpi-label").toClassName()}>
                      {kpi.label}
                    </Typography>
                    <Typography className={cn("projects-page").elem("kpi-value").toClassName()}>
                      {kpi.value}
                    </Typography>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {visibleProjects.length ? (
            <ProjectsList
              projects={visibleProjects}
              currentPage={currentPage}
              totalItems={totalItems}
              loadNextPage={loadNextPage}
              pageSize={defaultPageSize}
            />
          ) : (
            <EmptyProjectsList openModal={openModal} />
          )}
          {modal && <CreateProject onClose={closeModal} />}
        </div>
      </Oneof>
    </div>
  );
};

ProjectsPage.title = "Projects";
ProjectsPage.path = "/projects";
ProjectsPage.exact = true;
ProjectsPage.routes = ({ store }) => [
  {
    title: () => store.project?.title,
    path: "/:id(\\d+)",
    exact: true,
    component: () => {
      const params = useRouterParams();

      return <Redirect to={`/projects/${params.id}/data`} />;
    },
    pages: {
      DataManagerPage,
      SettingsPage,
    },
  },
];
ProjectsPage.context = ({ openModal, showButton }) => {
  if (!showButton) return null;
  return (
    <Button onClick={openModal} size="small" aria-label="Create new project">
      Create
    </Button>
  );
};
