import { db } from "@/lib/db";
import { deleteBoothPhotoAction, hideBoothPhotoAction } from "@/app/actions/booth";
import { ActionButton } from "@/components/action-button";
import { Badge, Card, CardBody, EmptyState, PageTitle } from "@/components/ui";
import { boothThumb } from "@/lib/photo-url";
import { adminPage } from "../_lib";

export const metadata = { title: "Photobooth" };

export default async function AdminBoothPage() {
  await adminPage();
  const photos = await db.boothPhoto.findMany({ orderBy: { createdAt: "desc" }, take: 120 });
  return (
    <>
      <PageTitle title="Photobooth" sub="Hide or delete anything that should not be in the public gallery." />
      {photos.length === 0 ? (
        <EmptyState title="No photos yet" />
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id}>
              <Card>
                <CardBody className="space-y-2">
                  <a href={p.imageUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the optimised size */}
                    <img src={boothThumb(p.imageUrl, 400)} alt="" loading="lazy" className="h-auto w-full rounded" />
                  </a>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge>{p.likeCount} likes</Badge>
                    {p.hidden && <Badge tone="warn">Hidden</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton action={hideBoothPhotoAction.bind(null, p.id, !p.hidden)}>{p.hidden ? "Unhide" : "Hide"}</ActionButton>
                    <ActionButton
                      variant="danger"
                      confirm="Delete this photo from the gallery?"
                      action={deleteBoothPhotoAction.bind(null, p.id)}
                    >
                      Delete
                    </ActionButton>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
