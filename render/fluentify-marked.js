let markedLinkTitleUid = 0;

export default (marked) => {
  return {
    renderer: {
      hr() {
        return `<fluent-divider></fluent-divider>`;
      },
      link(token) {
        if (token.title) {
          const linkId = `marked-anchor-${markedLinkTitleUid++}`;
          return /* html */ `
            <fluent-tooltip anchor="${linkId}">${token.title}</fluent-tooltip>
            <fluent-anchor href="${token.href}" appearance="hypertext"
            id="${linkId}" aria-describedby="tooltip">
              ${token.text}
            </fluent-anchor>
        `;
        } else
          return /* html */ `
            <fluent-anchor href="${token.href}" appearance="hypertext">
              ${token.text}
            </fluent-anchor>
        `;
      },
      table(token) {
        const { header, rows } = token;

        /** @param {Array} r */
        const parseCells = (r) =>
          r
            .map(
              (c, i) => /* html */ `
                <fluent-data-grid-cell grid-column="${i + 1}"
                ${c.header ? 'cell-type="columnheader"' : ""}
                ${c.align ? 'style="text-align: ' + c.align + '"' : ""}>
                  ${marked.Parser.parseInline(c.tokens)}
                </fluent-data-grid-cell>`,
            )
            .join("");

        return /* html */ `
          <fluent-data-grid>
            <fluent-data-grid-row row-type="header">
              ${parseCells(header)}
            </fluent-data-grid-row>
            ${rows
              .map(
                (row) =>
                  "<fluent-data-grid-row>" +
                  parseCells(row) +
                  "</fluent-data-grid-row>",
              )
              .join("")}
          </fluent-data-grid>`;
      },
      listitem(token) {
        if (token.checked == undefined) return false;
        return /* html */ `
          <li>
            <fluent-checkbox ${token.checked ? "checked" : ""} disabled style="opacity: 1">
              ${marked.Parser.parseInline(token.tokens)}
            </fluent-checkbox>
          </li>
        `;
      },
    },
  };
};
