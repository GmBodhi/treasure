import Primitives from './Primitives.jsx';

/**
 * A-Frame text is geometry, not markup — an `<em>` reaching `a-text` renders as
 * the literal characters. Clue copy is authored as HTML, so anything routed
 * into 3D has to be flattened first.
 */
const stripTags = (text) => String(text).replace(/<[^>]*>/g, '');

/**
 * Card overlay. Units are marker widths: the tracked image is exactly 1 wide,
 * so the type has to be sized against that, not against pixels.
 */
function Card({ marker, overlay }) {
  const width = overlay.width ?? 1;
  const height = overlay.height ?? 0.552;
  const accent = overlay.color ?? marker.accent ?? '#101418';

  // The card is 3D text on the marker, so it wants a short line — not the
  // reveal copy, which is long-form HTML meant for a screen you can scroll.
  // `overlay.title`/`overlay.body` are how a station says what belongs in AR;
  // falling back to the marker's own fields keeps older overlays working.
  const title = overlay.title ?? marker.title ?? '';
  const body = stripTags(overlay.body ?? marker.body ?? '');

  return (
    <>
      <a-plane
        color={accent}
        opacity={String(overlay.opacity ?? 0.85)}
        width={String(width)}
        height={String(height)}
        position="0 0 0.01"
        animation="property: scale; from: 0.86 0.86 1; to: 1 1 1; dur: 320; easing: easeOutBack"
      />
      <a-text
        value={title}
        color={marker.accent ?? '#f0b429'}
        align="center"
        width={(width * 0.92).toFixed(3)}
        wrap-count="20"
        position={`0 ${(height * 0.22).toFixed(3)} 0.02`}
      />
      <a-text
        value={body}
        color="#f2f5f8"
        align="center"
        width={(width * 0.8).toFixed(3)}
        wrap-count="42"
        position={`0 ${(height * -0.08).toFixed(3)} 0.02`}
      />
    </>
  );
}

/**
 * Placement sits on a wrapper so an animation on the model can spin it about
 * its own axis. Both on one entity and the two euler rotations fight, which
 * reads as the model tumbling.
 */
function Model({ overlay }) {
  return (
    <a-entity position={overlay.position ?? '0 0 0.1'} rotation={overlay.rotation ?? '0 0 0'}>
      <a-gltf-model
        src={overlay.src}
        scale={overlay.scale ?? '0.3 0.3 0.3'}
        {...(overlay.animation ? { animation: overlay.animation } : {})}
      />
    </a-entity>
  );
}

export default function Overlay({ marker }) {
  const overlay = marker.overlay ?? { type: 'card' };

  switch (overlay.type) {
    case 'model':
      return <Model overlay={overlay} />;

    case 'video':
      // The source itself is registered in <a-assets>; this only references it.
      return (
        <a-video
          src={`#video-${marker.id}`}
          width={String(overlay.width ?? 1)}
          height={String(overlay.height ?? 0.552)}
          position={overlay.position ?? '0 0 0.02'}
        />
      );

    case 'image':
      return (
        <a-image
          src={overlay.src}
          width={String(overlay.width ?? 1)}
          height={String(overlay.height ?? 0.552)}
          position={overlay.position ?? '0 0 0.02'}
        />
      );

    case 'primitives':
      return <Primitives overlay={overlay} />;

    case 'none':
      return null;

    case 'card':
    default:
      return <Card marker={marker} overlay={overlay} />;
  }
}
