/** Resolve only published translation links. Votes remain attached to native document IDs. */
export function buildRegistry(posts) {
  const keys = new Map(posts.map(p => [p.language + "/" + p.slug, p._id]));
  const byId = new Map(posts.map(p => [p._id, p]));
  const parent = new Map(posts.map(p => [p._id, p._id]));
  function root(id) {
    const next = parent.get(id);
    if (next === id) return id;
    const result = root(next);
    parent.set(id, result);
    return result;
  }
  for (const post of posts) {
    if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(post._id) || post._id.startsWith("drafts."))
      throw new Error("Invalid reaction document ID");
    const target = post.translation && keys.get(post.translation.language + "/" + post.translation.slug);
    if (target && target !== post._id) parent.set(root(post._id), root(target));
  }
  const groups = new Map();
  for (const post of posts) {
    const key = root(post._id);
    groups.set(key, [...(groups.get(key) || []), post._id]);
  }
  const registry = Object.create(null);
  for (const ids of groups.values()) {
    if (ids.length > 2 || new Set(ids.map(id => byId.get(id).language)).size !== ids.length)
      throw new Error("A translated reaction group must contain at most one post per language");
    ids.sort();
    for (const id of ids) registry[id] = ids;
  }
  return registry;
}
