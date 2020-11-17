/*
 * @Author: your name
 * @Date: 2020-11-12 15:33:17
 * @LastEditTime: 2020-11-16 17:12:49
 * @LastEditors: HAYWAEL
 * @Description: In User Settings Edit
 * @FilePath: /simpleReact/src/index.js
 */






function commitRoot() {
    deletions.forEach(commitWork)
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}



function commitWork(fiber) {
    if (!fiber) {
        return
    }


    let domParentFiber=fiber.parent;
    while(!domParentFiber.dom){
        domParentFiber=domParentFiber.parent
    }

    // 比如这种结构  <div><A><B><span>real Node</span></B></A></div> span会一层层往上找真实父节点 直到找到 div节点，主要为了处理函数组件；

    const domParent = domParentFiber.dom
    if (
        fiber.effectTag === "PLACEMENT" &&
        fiber.dom != null
    ) {
        domParent.appendChild(fiber.dom)
    } else if (
        fiber.effectTag === "UPDATE" &&
        fiber.dom != null
    ) {
        updateDom(
            fiber.dom,
            fiber.alternate.props,
            fiber.props
        )
    } else if (fiber.effectTag === "DELETION") {
        commitDeletion(fiber,domParent)
    }

    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

function commitDeletion(fiber,domParent){
    if(fiber.dom){
        domParent.removeChild(fiber.dom) 
    }else{
        commitDeletion(fiber.child,domParent)
    }
}



function createElement(type, props, ...children) {
    return {
        type,
        props: {
            ...props,
            children: children.map(child =>
                typeof child === "object"
                    ? child
                    : createTextElement(child)
            ),
        },
    }
}




function createTextElement(text) {
    return {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: [],
        },
    }
}



function createDom(fiber) {
    const dom =
        fiber.type === "TEXT_ELEMENT"
            ? document.createTextNode("")
            : document.createElement(fiber.type)

    updateDom(dom, {}, fiber.props)

    return dom
}
const isEvent = key => key.startsWith("on")
const isProperty = key =>
    key !== "children" && !isEvent(key)
const isNew = (prev, next) => key =>
    prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)





function updateDom(dom, prevProps, nextProps) {
    //Remove old or changed event listeners
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(
            key =>
                !(key in nextProps) ||
                isNew(prevProps, nextProps)(key)
        )
        .forEach(name => {
            const eventType = name
                .toLowerCase()
                .substring(2)
            dom.removeEventListener(
                eventType,
                prevProps[name]
            )
        })

    // Remove old properties
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(name => {
            dom[name] = ""
        })

    // Set new or changed properties
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            dom[name] = nextProps[name]
        })

    // Add event listeners
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            const eventType = name
                .toLowerCase()
                .substring(2)
            dom.addEventListener(
                eventType,
                nextProps[name]
            )
        })
}




function render(element, container) {
    wipRoot = {
        dom: container,
        props: {
            children: [element],
        },
        alternate: currentRoot,
    }
    deletions = []
    nextUnitOfWork = wipRoot
}


let nextUnitOfWork = null
let currentRoot = null
let wipRoot = null
let deletions = null



function workLoop(deadline) {
    let shouldYield = false
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(
            nextUnitOfWork
        )
        shouldYield = deadline.timeRemaining() < 1
    }

    if (!nextUnitOfWork && wipRoot) {
        commitRoot()
    }

    requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)



function updateHostComponent(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }
    const elements = fiber.props.children
    reconcileChildren(fiber, elements)
}

let wipFiber=null;
let hookIndex=null

function updateFunctionComponent(fiber){
    wipFiber=fiber
    hookIndex=0;
    wipFiber.hooks=[];
    const children=[fiber.type(fiber.props)]
    reconcileChildren(fiber, children)
}

function useState(initial){
    const oldHook=wipFiber.alternate&&wipFiber.alternate.hooks&&wipFiber.alternate.hooks[hookIndex];
    const hook={
        state:oldHook?oldHook.state:initial,
        queue:[]
    }
    const actions= oldHook?oldHook.queue:[];
    actions.forEach(action=>{
        hook.state=action(hook.state)
    })
    const setState=action=>{
        hook.queue.push(action);
        wipRoot={
            dom:currentRoot.dom,
            props:currentRoot.props,
            alternate:currentRoot
        }
        nextUnitOfWork = wipRoot;
        deletions=[]
    }
    wipFiber.hooks.push(hook)
    hookIndex++;
    return [hook.state,setState]
}

function performUnitOfWork(fiber) {
    const isFunctionComponent = fiber.type instanceof Function;
    if (isFunctionComponent) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }
    if (fiber.child) {
        return fiber.child
    }
    let nextFiber = fiber
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent
    }
}




function reconcileChildren(wipFiber, elements) {
    let index = 0;
    let prveSibling = null
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child;

    while (index < elements.length || oldFiber != null) {

        const element = elements[index];
        let newFiber = null
        const sameType = oldFiber && element && element.type === oldFiber.type;
        //类型不同  just update it with the new props
        if (sameType) {
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: 'UPDATE'
            }
        }
        // 新元素 而且类型不同 need create a new DOM node
        if (element && !sameType) {
            console.log(element)
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null,
                parent: wipFiber,
                alternate: null,
                effectTag: 'PLACEMENT'
            }
        }

        // remove the old node
        if (oldFiber && !sameType) {
            oldFiber.effectTag = 'DELETION';
            deletions.push(oldFiber)
        }

        if (oldFiber) {
            oldFiber = oldFiber.sibling
        }

        if (index === 0) {
            wipFiber.child = newFiber
        } else if (element) {
            prveSibling.sibling = newFiber
        }
        prveSibling = newFiber
        index++
    }
}



const Didact = {
    createElement,
    render,
    useState
}

/** @jsx Didact.createElement */
const container = document.getElementById("root")

const updateValue = e => {
    rerender(e.target.value)
}

function Counter() {
    const [count,setState]=Didact.useState(1)
    return <h1 onClick={()=>setState(val=>val+1)}>Count:{count}</h1>
  }


const rerender = value => {
    const element = (
        <div>
            <input onInput={updateValue} value={value} />
            <h2>Hello {value}</h2>
            {value ? <h2>{value}</h2> : <h2>empty</h2>}
            <Counter />
        </div>
    )
    Didact.render(element, container)
}

rerender("World")