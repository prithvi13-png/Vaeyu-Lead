export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
  })
}
