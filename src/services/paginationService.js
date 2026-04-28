function buildPageLink(req, page) {
  const requestUrl = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
  requestUrl.searchParams.set("page", String(page));

  return requestUrl.toString();
}

export function buildPaginatedPayload(req, result) {
  const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / result.limit);

  return {
    status: "success",
    page: result.page,
    limit: result.limit,
    total: result.total,
    total_pages: totalPages,
    links: {
      self: buildPageLink(req, result.page),
      next: totalPages > result.page ? buildPageLink(req, result.page + 1) : null,
      prev: result.page > 1 ? buildPageLink(req, result.page - 1) : null,
    },
    data: result.data,
  };
}
