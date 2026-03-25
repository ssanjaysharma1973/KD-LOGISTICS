#!/usr/bin/env python3
"""Simple asyncio TCP forwarder.
Usage: python app_proxy.py --listen 127.0.0.1:8501 --target 127.0.0.1:8503
This runs without admin privileges and forwards raw TCP between listen and target.
"""
import asyncio
import argparse

async def handle_client(client_reader, client_writer, target_host, target_port):
    try:
        target_reader, target_writer = await asyncio.open_connection(target_host, target_port)
    except Exception as e:
        print(f"Failed to connect to target {target_host}:{target_port}: {e}")
        client_writer.close()
        await client_writer.wait_closed()
        return

    async def pipe(reader, writer):
        try:
            while True:
                data = await reader.read(4096)
                if not data:
                    break
                writer.write(data)
                await writer.drain()
        except Exception:
            pass
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    # bidirectional copy
    task1 = asyncio.create_task(pipe(client_reader, target_writer))
    task2 = asyncio.create_task(pipe(target_reader, client_writer))
    await asyncio.wait([task1, task2], return_when=asyncio.FIRST_COMPLETED)
    for t in (task1, task2):
        if not t.done():
            t.cancel()
    try:
        target_writer.close()
    except Exception:
        pass
    try:
        client_writer.close()
    except Exception:
        pass


async def main(listen_host, listen_port, target_host, target_port):
    server = await asyncio.start_server(lambda r, w: handle_client(r, w, target_host, target_port), listen_host, listen_port)
    addrs = ', '.join(str(sock.getsockname()) for sock in server.sockets)
    print(f"Proxy listening on {addrs}, forwarding to {target_host}:{target_port}")
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--listen', default='127.0.0.1:8501')
    p.add_argument('--target', default='127.0.0.1:8503')
    args = p.parse_args()
    lh, lp = args.listen.split(':')
    th, tp = args.target.split(':')
    asyncio.run(main(lh, int(lp), th, int(tp)))
